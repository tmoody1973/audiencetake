import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createSocialStore } from "../../lib/social/store";

const projectId = "published-project";
const pathwayIds = ["pathway-series", "pathway-feature", "pathway-direct"] as const;

describe("native social transactions against the Firestore emulator", () => {
  let app: App;
  let database: Firestore;

  beforeAll(() => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      throw new Error("Run this suite through `npm run test:emulators`.");
    }
    app = initializeApp({ projectId: "audience-take-demo" }, `social-integration-${Date.now()}`);
    database = getFirestore(app);
  });

  beforeEach(async () => {
    const collections = await database.listCollections();
    await Promise.all(collections.map((collection) => database.recursiveDelete(collection)));
    await Promise.all([
      database.collection("projects").doc(projectId).set({
        publicationStatus: "published",
        moderationState: "clear",
        latestCardVersionId: "card-v1",
        followerCount: 0,
        demoFollowerCount: 0,
        takeCount: 0,
        demoTakeCount: 0,
        replyCount: 0,
        demoReplyCount: 0,
        commitmentCounts: {},
        demoCommitmentCounts: {},
        pathwayVoteCounts: {},
        demoPathwayVoteCounts: {},
      }),
      database.collection("scoutCards").doc("card-v1").set({
        projectId,
        visibility: "public",
        pathways: pathwayIds.map((id) => ({ id })),
      }),
    ]);
  });

  afterAll(async () => {
    await deleteApp(app);
  });

  it("serializes duplicate follow requests and repeated withdrawals", async () => {
    const store = createSocialStore(database);
    await Promise.all(Array.from({ length: 4 }, () => store.follow(projectId, "fan-one", true)));
    expect((await database.collection("projects").doc(projectId).get()).data()?.followerCount).toBe(1);
    expect((await database.collection("follows").doc(`${projectId}_fan-one`).get()).data()?.active).toBe(true);

    await store.follow(projectId, "fan-one", false);
    await store.follow(projectId, "fan-one", false);
    expect((await database.collection("projects").doc(projectId).get()).data()?.followerCount).toBe(0);
  });

  it("validates city intent and keeps commitment counters idempotent", async () => {
    const store = createSocialStore(database);
    await expect(store.commitment(projectId, "fan-one", "bring_to_city", true)).rejects.toMatchObject({ code: "city_required" });
    await store.commitment(projectId, "fan-one", "bring_to_city", true, "Chicago");
    await store.commitment(projectId, "fan-one", "bring_to_city", true, "Milwaukee");
    expect((await database.collection("projects").doc(projectId).get()).data()?.commitmentCounts).toEqual({ bring_to_city: 1 });
    expect((await database.collection("commitments").doc(`${projectId}_fan-one_bring_to_city`).get()).data()?.city).toBe("Milwaukee");

    await store.commitment(projectId, "fan-one", "bring_to_city", false);
    await store.commitment(projectId, "fan-one", "bring_to_city", false);
    expect((await database.collection("projects").doc(projectId).get()).data()?.commitmentCounts).toEqual({ bring_to_city: 0 });
  });

  it("moves one vote, couples a Take to it, and preserves reply history across withdrawal", async () => {
    const store = createSocialStore(database);
    await store.vote(projectId, "fan-one", pathwayIds[0], true);
    await store.vote(projectId, "fan-one", pathwayIds[1], true);
    expect((await database.collection("projects").doc(projectId).get()).data()?.pathwayVoteCounts).toEqual({
      [pathwayIds[0]]: 0,
      [pathwayIds[1]]: 1,
    });

    const input = {
      whyItShouldGrow: "Its creator-led world deserves a bounded audience test.",
      preferredPathwayId: pathwayIds[2],
      audienceNote: "For animation and psychological-thriller fans.",
    };
    await store.take(projectId, "fan-one", input, true);
    await store.take(projectId, "fan-one", input, true, true);
    let project = (await database.collection("projects").doc(projectId).get()).data();
    expect(project).toMatchObject({
      takeCount: 1,
      pathwayVoteCounts: {
        [pathwayIds[0]]: 0,
        [pathwayIds[1]]: 0,
        [pathwayIds[2]]: 1,
      },
    });

    const takeId = `${projectId}_fan-one`;
    await store.reply(takeId, "fan-two", "A concise reply.", "create");
    await store.reply(takeId, "fan-two", "An edited concise reply.", "edit");
    project = (await database.collection("projects").doc(projectId).get()).data();
    expect(project?.replyCount).toBe(1);
    expect((await database.collection("takes").doc(takeId).get()).data()?.replyCount).toBe(1);

    await store.take(projectId, "fan-one", input, false);
    project = (await database.collection("projects").doc(projectId).get()).data();
    expect(project).toMatchObject({ takeCount: 0, replyCount: 0 });
    expect((await database.collection("replies").doc(`${takeId}_fan-two`).get()).data()?.active).toBe(true);

    await store.take(projectId, "fan-one", input, true);
    project = (await database.collection("projects").doc(projectId).get()).data();
    expect(project).toMatchObject({ takeCount: 1, replyCount: 1 });
    await store.reply(takeId, "fan-two", "", "withdraw");
    await store.reply(takeId, "fan-two", "", "withdraw");
    project = (await database.collection("projects").doc(projectId).get()).data();
    expect(project?.replyCount).toBe(0);
    expect((await database.collection("takes").doc(takeId).get()).data()?.replyCount).toBe(0);
  });

  it("labels demo activity and keeps it out of organic counters", async () => {
    const demoStore = createSocialStore(database, { demoOnly: true });
    await demoStore.follow(projectId, "demo-creator", true);
    await demoStore.commitment(projectId, "demo-creator", "would_watch", true);
    const input = {
      whyItShouldGrow: "A clearly labeled demonstration Take.",
      preferredPathwayId: pathwayIds[0],
    };
    await demoStore.take(projectId, "demo-creator", input, true);
    const takeDocumentId = `${projectId}_demo-creator`;
    await demoStore.reply(takeDocumentId, "demo-creator", "A labeled demo reply.", "create");

    const project = (await database.collection("projects").doc(projectId).get()).data();
    expect(project).toMatchObject({
      followerCount: 0,
      demoFollowerCount: 1,
      takeCount: 0,
      demoTakeCount: 1,
      replyCount: 0,
      demoReplyCount: 1,
      commitmentCounts: {},
      demoCommitmentCounts: { would_watch: 1 },
      pathwayVoteCounts: {},
      demoPathwayVoteCounts: { [pathwayIds[0]]: 1 },
    });
    expect((await database.collection("takes").doc(takeDocumentId).get()).data()).toMatchObject({
      demoOnly: true,
      demoLabel: "Demo activity",
      demoReplyCount: 1,
    });
    expect((await database.collection("replies").doc(`${takeDocumentId}_demo-creator`).get()).data()).toMatchObject({
      demoOnly: true,
      demoLabel: "Demo activity",
    });
  });
});
