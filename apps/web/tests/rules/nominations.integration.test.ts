import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createFirestoreNominationStore, type PreparedNomination } from "../../lib/nomination/store";
import { sourceFingerprint } from "../../lib/nomination/url-policy";

const canonicalUrl = "https://www.youtube.com/watch?v=M2djoKmnOTY";
const supportingUrl = "https://example.com/junichiro-source";

function nomination(uid: string): PreparedNomination {
  return {
    submittedUrl: `${canonicalUrl}&utm_source=integration`,
    whyItShouldGrow:
      "Its near-future Brooklyn, hip-hop identity, and supernatural horror suggest a distinctive animated world worth scouting.",
    submissionType: "fan",
    suggestedFormat: "An adult animated series or independent feature",
    audienceFit: "Fans of creator-led animation and psychological horror.",
    supportingUrls: [supportingUrl],
    canonicalUrl,
    canonicalSupportingUrls: [supportingUrl],
    fingerprint: sourceFingerprint(canonicalUrl),
    nominatorUid: uid,
  };
}

describe("nomination persistence against the Firestore emulator", () => {
  let app: App;
  let database: Firestore;

  beforeAll(() => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      throw new Error("Run this suite through `npm run test:emulators`.");
    }
    app = initializeApp({ projectId: "audience-take-demo" }, `nomination-integration-${Date.now()}`);
    database = getFirestore(app);
  });

  beforeEach(async () => {
    const collections = await database.listCollections();
    await Promise.all(collections.map((collection) => database.recursiveDelete(collection)));
  });

  afterAll(async () => {
    await deleteApp(app);
  });

  it("serializes equivalent concurrent submissions into one canonical project and run", async () => {
    const store = createFirestoreNominationStore(database);
    const [first, second] = await Promise.all([
      store.accept(nomination("fan-one")),
      store.accept(nomination("fan-two")),
    ]);

    expect([first.kind, second.kind].sort()).toEqual(["created", "duplicate"]);
    const created = first.kind === "created" ? first : second;
    const duplicate = first.kind === "duplicate" ? first : second;
    expect(created.kind).toBe("created");
    expect(duplicate.kind).toBe("duplicate");
    if (created.kind !== "created") throw new Error("Expected one created nomination.");
    expect(duplicate.projectId).toBe(created.projectId);
    expect(duplicate.canonicalUrl).toBe(created.canonicalUrl);

    const counts = await Promise.all(
      ["sourceFingerprints", "projects", "nominations", "researchRuns", "publicResearchRuns", "events", "evidenceSuggestions", "evidenceSuggestionOwnership"].map(
        async (name) => (await database.collection(name).get()).size,
      ),
    );
    expect(counts).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);

    const storedNomination = (await database.collection("nominations").limit(1).get()).docs[0];
    expect(storedNomination.data()).toMatchObject({
      nominatorUid: expect.stringMatching(/^fan-(one|two)$/),
      submittedUrl: expect.stringContaining("utm_source=integration"),
      canonicalUrl,
      submissionType: "fan",
    });
    const publicLead = (await database.collection("evidenceSuggestions").limit(1).get()).docs[0].data();
    expect(publicLead).toMatchObject({
      projectId: created.projectId,
      submitterLabel: "Community member",
      url: supportingUrl,
      status: "community_lead",
    });
    expect(publicLead).not.toHaveProperty("submittedByUid");
    expect(publicLead).not.toHaveProperty("nominationId");
    const privateOwnership = (await database.collection("evidenceSuggestionOwnership").limit(1).get()).docs[0].data();
    expect(privateOwnership).toMatchObject({
      projectId: created.projectId,
      submittedByUid: expect.stringMatching(/^fan-(one|two)$/),
      nominationId: storedNomination.id,
      submissionOrigin: "nomination_supporting_link",
    });
    const publicRun = (await database.collection("publicResearchRuns").limit(1).get()).docs[0];
    expect(publicRun.data()).toEqual({
      runId: created.runId,
      projectId: created.projectId,
      attempt: 1,
      researchVersion: 1,
      status: "queued",
      currentStage: 1,
      completedStages: [],
      missingStages: [],
      publicFailureMessage: null,
      projectSlug: expect.stringMatching(/^project-[a-z0-9]+$/),
      cardUrl: expect.stringMatching(/^\/projects\/project-[a-z0-9]+$/),
      retryEligible: false,
      fallbackUsed: false,
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });
});
