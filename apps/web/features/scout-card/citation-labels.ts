import type { SourceLedgerEntry } from "./types";

export function createCitationLabels(sources: SourceLedgerEntry[]) {
  const labels = new Map<string, string>();
  sources.forEach((source, index) => labels.set(source.id, `S${index + 1}`));
  return labels;
}

export function citationText(ids: string[], labels: Map<string, string>): string {
  const citations = ids.map((id) => labels.get(id)).filter((label): label is string => Boolean(label));
  return citations.length ? citations.map((label) => `[${label}]`).join(" ") : "No cited source";
}
