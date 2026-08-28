import type { EvidenceSuggestionInput } from "./contract";
import type { EvidenceStore } from "./store";
import { evidenceFingerprint } from "./store";
import { youtubeVideoId } from "../media/youtube";
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
  const checkedUrl = await intakePublicUrl(input.url, dependencies.urlPolicy);
  const videoId = input.suggestedUse ? youtubeVideoId(checkedUrl) : null;
  const canonicalUrl = videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : checkedUrl;
  return dependencies.store.submit({
    projectId,
    submittedByUid,
    canonicalUrl,
    fingerprint: evidenceFingerprint(projectId, canonicalUrl),
    ...(input.note ? { note: input.note } : {}),
    ...(input.suggestedUse ? { suggestedUse: input.suggestedUse } : {}),
  });
}
