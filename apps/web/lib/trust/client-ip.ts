import { isIP } from "node:net";

export function trustedVercelClientIp(request: Request): string | null {
  if (process.env.VERCEL !== "1") return null;

  const value = request.headers.get("x-forwarded-for")?.trim();
  if (!value || value.includes(",") || isIP(value) === 0) return null;
  return value;
}
