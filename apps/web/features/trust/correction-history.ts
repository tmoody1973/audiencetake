export type CorrectionVersionLink = {
  fromCardVersionId?: string;
  toCardVersionId?: string;
};

export function initialCardVersionId(
  currentCardVersionId: string,
  corrections: CorrectionVersionLink[],
): string {
  const predecessor = new Map(
    corrections.flatMap((correction) => (
      correction.fromCardVersionId && correction.toCardVersionId
        ? [[correction.toCardVersionId, correction.fromCardVersionId] as const]
        : []
    )),
  );
  const visited = new Set<string>();
  let candidate = currentCardVersionId;
  while (predecessor.has(candidate) && !visited.has(candidate)) {
    visited.add(candidate);
    candidate = predecessor.get(candidate)!;
  }
  return candidate;
}
