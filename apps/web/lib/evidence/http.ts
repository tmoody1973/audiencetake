export const MAX_EVIDENCE_BODY_BYTES = 16_384;

export async function readEvidenceJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_EVIDENCE_BODY_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_EVIDENCE_BODY_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("INVALID_JSON");
  }
}
