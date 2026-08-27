import type { EvidenceSuggestionInput } from "./contract";
import type { EvidenceStore } from "./store";
import { evidenceFingerprint } from "./store";
import {
  intakePublicUrl,
  type SafeUrlPolicy,
} from "../nomination/url-policy";

export async function suggestEvidence(
  projectId: string,
  submittedByUid: string,
  input: EvidenceSuggestionInput,
  dependencies: { store: EvidenceStore; urlPolicy?: SafeUrlPolicy },
) {
  const canonicalUrl = await intakePublicUrl(input.url, dependencies.urlPolicy);
  return dependencies.store.submit({
    projectId,
    submittedByUid,
    canonicalUrl,
    fingerprint: evidenceFingerprint(projectId, canonicalUrl),
    ...(input.note ? { note: input.note } : {}),
  });
}
