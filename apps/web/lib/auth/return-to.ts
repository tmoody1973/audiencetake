const SAFE_RETURN_TO = /^\/(?!\/)[^\s]*$/;

export function sanitizeReturnTo(value: string | null | undefined, fallback = "/"): string {
  if (!value || !SAFE_RETURN_TO.test(value)) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://audiencetake.local");
    if (parsed.origin !== "https://audiencetake.local") {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
