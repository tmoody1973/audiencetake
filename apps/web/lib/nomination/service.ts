import type { NominationInput } from "./contract";
import type { NominationStore } from "./store";
import { youtubeVideoId } from "../media/youtube";
import {
  intakePublicUrl,
  sourceFingerprint,
  type SafeUrlPolicy,
  UnsafeUrlError,
} from "./url-policy";

export type ResearchDispatcher = (job: {
  runId: string;
  projectId: string;
  nominationId: string;
  attempt: number;
}) => Promise<void>;

export type NominationResult =
  | { duplicate: true; projectId: string; canonicalUrl: string }
  | {
      duplicate: false;
      projectId: string;
      nominationId: string;
      runId: string;
      researchUrl: string;
      canonicalUrl: string;
      dispatchState: "dispatched" | "retryable_failed";
    };

export async function acceptNomination(
  input: NominationInput,
  nominatorUid: string,
  dependencies: {
    store: NominationStore;
    dispatch: ResearchDispatcher;
    urlPolicy?: SafeUrlPolicy;
  },
): Promise<NominationResult> {
  const canonicalUrl = await intakePublicUrl(input.submittedUrl, dependencies.urlPolicy);
  const checkedMediaUrl = input.mediaUrl
    ? await intakePublicUrl(input.mediaUrl, dependencies.urlPolicy)
    : undefined;
  const mediaVideoId = checkedMediaUrl ? youtubeVideoId(checkedMediaUrl) : null;
  if (checkedMediaUrl && mediaVideoId === null) {
    throw new UnsafeUrlError(
      "Use a supported public YouTube video URL for the Scout Card player.",
      "unsupported_media",
    );
  }
  const canonicalMediaUrl = mediaVideoId
    ? `https://www.youtube.com/watch?v=${mediaVideoId}`
    : undefined;
  const canonicalSupportingUrls = await Promise.all(
    input.supportingUrls.map((url) => intakePublicUrl(url, dependencies.urlPolicy)),
  );
  const uniqueSupportingUrls = [...new Set(canonicalSupportingUrls)].filter(
    (url) =>
      url !== canonicalUrl
      && url !== canonicalMediaUrl
      && (!mediaVideoId || youtubeVideoId(url) !== mediaVideoId),
  );
  const accepted = await dependencies.store.accept({
    ...input,
    canonicalUrl,
    canonicalMediaUrl,
    canonicalSupportingUrls: uniqueSupportingUrls,
    fingerprint: sourceFingerprint(canonicalUrl),
    nominatorUid,
  });

  if (accepted.kind === "duplicate") {
    return { duplicate: true, projectId: accepted.projectId, canonicalUrl: accepted.canonicalUrl };
  }

  let dispatchState: "dispatched" | "retryable_failed" = "dispatched";
  try {
    await dependencies.dispatch({
      runId: accepted.runId,
      projectId: accepted.projectId,
      nominationId: accepted.nominationId,
      attempt: 1,
    });
    await dependencies.store.markDispatched(accepted.runId);
  } catch {
    dispatchState = "retryable_failed";
    await dependencies.store.markDispatchFailed(
      accepted.runId,
      "Research is queued, but dispatch needs an automatic retry.",
    );
  }

  return {
    duplicate: false,
    projectId: accepted.projectId,
    nominationId: accepted.nominationId,
    runId: accepted.runId,
    researchUrl: accepted.researchUrl,
    canonicalUrl: accepted.canonicalUrl,
    dispatchState,
  };
}

export function noOpResearchDispatcher(): ResearchDispatcher {
  return async () => {
    // Item 5 replaces this local acceptance seam with the durable Cloud Tasks
    // dispatcher. Refuse silent use so a run cannot appear sent.
    throw new Error("Cloud Tasks dispatch is not configured.");
  };
}
