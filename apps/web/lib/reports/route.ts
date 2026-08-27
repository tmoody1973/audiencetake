import type { NextRequest } from "next/server";

const MAX_REPORT_BODY_BYTES = 8_192;

export async function readReportJson(request: NextRequest): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REPORT_BODY_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REPORT_BODY_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("INVALID_JSON");
  }
}
