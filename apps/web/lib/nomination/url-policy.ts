import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "si",
  "vero_conv",
  "vero_id",
]);

const NON_PUBLIC_SUFFIXES = [
  ".internal",
  ".invalid",
  ".lan",
  ".local",
  ".localhost",
  ".test",
];

export type AddressResolver = (hostname: string) => Promise<string[]>;

export type ProbeResult = {
  status: number;
  location?: string;
  contentLength?: number;
  contentType?: string;
};

export type UrlProbe = (url: URL, resolvedAddresses?: readonly string[]) => Promise<ProbeResult>;

export type SafeUrlPolicy = {
  allowedHttpHosts?: ReadonlySet<string>;
  maxRedirects?: number;
  maxResponseBytes?: number;
  resolve?: AddressResolver;
  probe?: UrlProbe;
};

export class UnsafeUrlError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_url"
      | "unsafe_protocol"
      | "credentials_not_allowed"
      | "non_public_host"
      | "unsafe_redirect"
      | "too_many_redirects"
      | "response_too_large"
      | "unsupported_media"
      | "source_unreachable",
  ) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? parts
    : null;
}

export function isPublicIpAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const parts = parseIpv4(address);
    if (!parts) return false;
    const [a, b] = parts;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && parts[2] === 0) ||
      (a === 192 && b === 0 && parts[2] === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && parts[2] === 100) ||
      (a === 203 && b === 0 && parts[2] === 113) ||
      a >= 224
    );
  }
  if (version === 6) {
    const normalized = address.toLowerCase().split("%")[0];
    if (normalized === "::" || normalized === "::1") return false;
    if (normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized)) return false;
    if (normalized.startsWith("ff")) return false;
    if (normalized.startsWith("2001:db8:")) return false;
    if (normalized.startsWith("::ffff:")) {
      return isPublicIpAddress(normalized.slice("::ffff:".length));
    }
    return true;
  }
  return false;
}

function assertPublicHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !normalized ||
    normalized === "localhost" ||
    NON_PUBLIC_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  ) {
    throw new UnsafeUrlError("Use a public internet address.", "non_public_host");
  }
  if (isIP(normalized) && !isPublicIpAddress(normalized)) {
    throw new UnsafeUrlError("Private and reserved network addresses are not allowed.", "non_public_host");
  }
}

export function canonicalizeUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new UnsafeUrlError("Enter a complete public URL.", "invalid_url");
  }

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");

  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (lower.startsWith("utm_") || TRACKING_PARAMETERS.has(lower)) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  return url.toString();
}

async function defaultResolve(hostname: string): Promise<string[]> {
  if (isIP(hostname.replace(/^\[|\]$/g, ""))) return [hostname.replace(/^\[|\]$/g, "")];
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map(({ address }) => address);
}

async function defaultProbe(url: URL, resolvedAddresses: readonly string[] = []): Promise<ProbeResult> {
  const address = resolvedAddresses[0];
  if (!address || !isPublicIpAddress(address)) {
    throw new UnsafeUrlError("The public source address could not be pinned safely.", "source_unreachable");
  }

  return new Promise((resolveProbe, rejectProbe) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      {
        protocol: url.protocol,
        hostname: address,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "HEAD",
        family: isIP(address),
        servername: url.hostname,
        headers: {
          host: url.host,
          "user-agent": "AudienceTake-SourceSafety/1.0",
        },
      },
      (response) => {
        const header = (name: string) => {
          const value = response.headers[name];
          return Array.isArray(value) ? value[0] : value;
        };
        const contentLength = Number(header("content-length"));
        response.resume();
        resolveProbe({
          status: response.statusCode ?? 502,
          location: header("location"),
          contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
          contentType: header("content-type"),
        });
      },
    );
    request.setTimeout(5_000, () => request.destroy(new Error("source probe timed out")));
    request.on("error", () => {
      rejectProbe(
        new UnsafeUrlError("The public source could not be reached safely.", "source_unreachable"),
      );
    });
    request.end();
  });
}

function assertProtocol(url: URL, allowedHttpHosts: ReadonlySet<string>) {
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs containing credentials are not allowed.", "credentials_not_allowed");
  }
  if (url.protocol === "https:") return;
  if (url.protocol === "http:" && allowedHttpHosts.has(url.hostname.toLowerCase())) return;
  throw new UnsafeUrlError("Use an HTTPS public source.", "unsafe_protocol");
}

function assertResponseMetadata(result: ProbeResult, maxResponseBytes: number) {
  if (result.contentLength !== undefined && result.contentLength > maxResponseBytes) {
    throw new UnsafeUrlError("The source is too large to inspect safely.", "response_too_large");
  }
  const mime = result.contentType?.split(";", 1)[0]?.trim().toLowerCase();
  if (
    mime &&
    !mime.startsWith("text/") &&
    !mime.startsWith("image/") &&
    !mime.startsWith("video/") &&
    !mime.startsWith("audio/") &&
    !["application/json", "application/ld+json", "application/pdf", "application/xhtml+xml"].includes(mime)
  ) {
    throw new UnsafeUrlError("That source media type is not supported.", "unsupported_media");
  }
}

export async function intakePublicUrl(input: string, policy: SafeUrlPolicy = {}): Promise<string> {
  const allowedHttpHosts = policy.allowedHttpHosts ?? new Set<string>();
  const resolve = policy.resolve ?? defaultResolve;
  const probe = policy.probe ?? defaultProbe;
  const maxRedirects = policy.maxRedirects ?? 3;
  const maxResponseBytes = policy.maxResponseBytes ?? 5_000_000;
  let current = new URL(canonicalizeUrl(input));

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    assertProtocol(current, allowedHttpHosts);
    assertPublicHostname(current.hostname);
    let addresses: string[];
    try {
      addresses = await resolve(current.hostname.replace(/^\[|\]$/g, ""));
    } catch (error) {
      if (error instanceof UnsafeUrlError) throw error;
      throw new UnsafeUrlError("The public source hostname could not be verified.", "source_unreachable");
    }
    if (!addresses.length || addresses.some((address) => !isPublicIpAddress(address))) {
      throw new UnsafeUrlError("The source resolves to a private or reserved network.", "non_public_host");
    }

    const result = await probe(current, addresses);
    assertResponseMetadata(result, maxResponseBytes);
    if (result.status < 300 || result.status >= 400) return canonicalizeUrl(current.toString());
    if (!result.location) {
      throw new UnsafeUrlError("The source returned an unsafe redirect.", "unsafe_redirect");
    }
    if (hop === maxRedirects) {
      throw new UnsafeUrlError("The source redirected too many times.", "too_many_redirects");
    }
    try {
      current = new URL(canonicalizeUrl(new URL(result.location, current).toString()));
    } catch (error) {
      if (error instanceof UnsafeUrlError) throw error;
      throw new UnsafeUrlError("The source returned an unsafe redirect.", "unsafe_redirect");
    }
  }

  throw new UnsafeUrlError("The source redirected too many times.", "too_many_redirects");
}

export function sourceFingerprint(canonicalUrl: string): string {
  return createHash("sha256").update(canonicalUrl, "utf8").digest("hex");
}
