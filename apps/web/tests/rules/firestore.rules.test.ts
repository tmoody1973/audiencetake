import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, where } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";

let environment: RulesTestEnvironment;

beforeAll(async () => {
  const [firestoreRules, storageRules] = await Promise.all([
    readFile(resolve(process.cwd(), "../../firebase/firestore.rules"), "utf8"),
    readFile(resolve(process.cwd(), "../../firebase/storage.rules"), "utf8"),
  ]);
  environment = await initializeTestEnvironment({
    projectId: "audience-take-demo",
    firestore: { host: "127.0.0.1", port: 8080, rules: firestoreRules },
    storage: { host: "127.0.0.1", port: 9199, rules: storageRules },
  });
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await Promise.all([
      setDoc(doc(database, "projects/published"), {
        publicationStatus: "published",
        moderationState: "clear",
        title: "Public Scout Card",
      }),
      setDoc(doc(database, "projects/draft"), {
        publicationStatus: "draft",
        title: "Private draft",
      }),
      setDoc(doc(database, "projects/moderated"), {
        publicationStatus: "published",
        moderationState: "hidden",
        title: "Moderated project",
      }),
      setDoc(doc(database, "users/fan-private"), {
        visibility: "public",
        publicActivity: false,
        displayName: "Private Activity Fan",
      }),
      setDoc(doc(database, "users/fan-public"), {
        visibility: "public",
        publicActivity: true,
        displayName: "Public Activity Fan",
      }),
      setDoc(doc(database, "roleAssignments/fan-private"), {
        roles: { admin: true },
      }),
      setDoc(doc(database, "claimRequests/private-claim"), {
        requesterUid: "fan-private",
        status: "pending",
      }),
      setDoc(doc(database, "reports/private-report"), {
        reporterUid: "fan-private",
        details: "Private report details",
      }),
      setDoc(doc(database, "researchRuns/private-run"), {
        projectId: "published",
        publicVisibility: true,
        leaseOwner: "server-worker",
      }),
      setDoc(doc(database, "publicResearchRuns/public-run"), {
        runId: "public-run",
        projectId: "pending-project",
        attempt: 1,
        researchVersion: 1,
        status: "running",
        currentStage: 3,
        completedStages: [1, 2],
        missingStages: [],
        publicFailureMessage: null,
        projectSlug: "pending-project",
        cardUrl: "/projects/pending-project",
        retryEligible: false,
        fallbackUsed: false,
        updatedAt: "2026-08-26T12:00:00Z",
      }),
      setDoc(doc(database, "events/public-event"), {
        projectId: "published",
        runId: "public-run",
        sequence: 1,
        attempt: 1,
        stage: 1,
        status: "active",
        kind: "stage",
        publicVisibility: "public",
        publicTitle: "Scouting public sources",
        publicSummary: "The public research run is reading the submitted source.",
        occurredAt: "2026-08-26T12:00:00Z",
      }),
      setDoc(doc(database, "events/private-event"), {
        projectId: "published",
        runId: "public-run",
        sequence: 2,
        attempt: 1,
        stage: 2,
        status: "active",
        kind: "stage",
        publicVisibility: "private",
        publicTitle: "Internal worker detail",
        publicSummary: "This row is intentionally private.",
        occurredAt: "2026-08-26T12:01:00Z",
      }),
      setDoc(doc(database, "publicResearchRuns/leaky-run"), {
        runId: "leaky-run",
        projectId: "pending-project",
        attempt: 1,
        researchVersion: 1,
        status: "running",
        currentStage: 2,
        completedStages: [1],
        missingStages: [],
        publicFailureMessage: null,
        projectSlug: "pending-project",
        cardUrl: "/projects/pending-project",
        retryEligible: false,
        fallbackUsed: false,
        updatedAt: "2026-08-26T12:00:00Z",
        leaseOwner: "must-not-be-public",
      }),
      setDoc(doc(database, "follows/private-follow"), {
        uid: "fan-private",
        projectId: "published",
        publicActivity: true,
        active: true,
      }),
      setDoc(doc(database, "follows/public-follow"), {
        uid: "fan-public",
        projectId: "published",
        publicActivity: false,
        active: true,
      }),
      setDoc(doc(database, "follows/inactive-follow"), {
        uid: "fan-public",
        projectId: "published",
        active: false,
      }),
      setDoc(doc(database, "commitments/private-commitment"), {
        uid: "fan-private",
        projectId: "published",
        active: false,
        type: "would_watch",
      }),
      setDoc(doc(database, "pathwayVotes/inactive-vote"), {
        uid: "fan-public",
        projectId: "published",
        active: false,
        visibility: "public",
      }),
      setDoc(doc(database, "nominations/public-nomination"), {
        nominatorUid: "fan-private",
        visibility: "public",
      }),
      setDoc(doc(database, "scoutCards/published-card-v1"), {
        projectId: "published",
        visibility: "public",
        cardVersionId: "published-card-v1",
      }),
      setDoc(doc(database, "scoutCards/pending-card-v1"), {
        projectId: "pending",
        visibility: "public",
        cardVersionId: "pending-card-v1",
      }),
      setDoc(doc(database, "takes/public-take"), {
        uid: "fan-private",
        projectId: "published",
        status: "published",
        active: true,
      }),
      setDoc(doc(database, "takes/withdrawn-take"), {
        uid: "fan-public",
        projectId: "published",
        status: "published",
        active: false,
      }),
      setDoc(doc(database, "replies/withdrawn-reply"), {
        uid: "fan-private",
        projectId: "published",
        takeId: "withdrawn-take",
        status: "published",
        active: true,
      }),
    ]);
    await uploadBytes(ref(context.storage(), "public/scout-cards/poster.txt"), new Uint8Array([1]));
    await uploadBytes(
      ref(context.storage(), "private/fan-private/claim-proof.txt"),
      new Uint8Array([2]),
    );
  });
});

afterAll(async () => {
  await environment.cleanup();
});

describe("Firestore public/private boundary", () => {
  it("allows anonymous visitors to read published projects only", async () => {
    const database = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(database, "projects/published")));
    await assertFails(getDoc(doc(database, "projects/draft")));
    await assertFails(getDoc(doc(database, "projects/moderated")));
  });

  it("publishes safe receipts while hiding research-run internals", async () => {
    const database = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(database, "events/public-event")));
    await assertFails(getDoc(doc(database, "events/private-event")));
    await assertFails(getDoc(doc(database, "researchRuns/private-run")));
  });

  it("restores the safe public run projection and its ordered public events", async () => {
    const database = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(database, "publicResearchRuns/public-run")));
    await assertFails(getDoc(doc(database, "publicResearchRuns/leaky-run")));
    await assertSucceeds(getDoc(doc(database, "scoutCards/published-card-v1")));
    await assertFails(getDoc(doc(database, "scoutCards/pending-card-v1")));
    await assertSucceeds(
      getDocs(
        query(
          collection(database, "events"),
          where("publicVisibility", "==", "public"),
          where("runId", "==", "public-run"),
          orderBy("sequence", "asc"),
        ),
      ),
    );
  });

  it("allows a claimant to read their own private request and report only", async () => {
    const owner = environment.authenticatedContext("fan-private").firestore();
    const other = environment.authenticatedContext("fan-public").firestore();
    await assertSucceeds(getDoc(doc(owner, "claimRequests/private-claim")));
    await assertSucceeds(getDoc(doc(owner, "reports/private-report")));
    await assertFails(getDoc(doc(other, "claimRequests/private-claim")));
    await assertFails(getDoc(doc(other, "reports/private-report")));
  });

  it("uses the profile toggle for follows instead of copied action data", async () => {
    const anonymous = environment.unauthenticatedContext().firestore();
    const privateOwner = environment.authenticatedContext("fan-private").firestore();
    const publicOwner = environment.authenticatedContext("fan-public").firestore();
    await assertFails(getDoc(doc(anonymous, "follows/private-follow")));
    await assertSucceeds(getDoc(doc(privateOwner, "follows/private-follow")));
    await assertSucceeds(getDoc(doc(anonymous, "follows/public-follow")));
    await assertFails(getDoc(doc(anonymous, "follows/inactive-follow")));
    await assertSucceeds(getDoc(doc(publicOwner, "follows/inactive-follow")));
    await assertSucceeds(getDoc(doc(privateOwner, "commitments/private-commitment")));
  });

  it("requires active public votes and hides replies to withdrawn Takes", async () => {
    const anonymous = environment.unauthenticatedContext().firestore();
    const voteOwner = environment.authenticatedContext("fan-public").firestore();
    const replyOwner = environment.authenticatedContext("fan-private").firestore();
    await assertFails(getDoc(doc(anonymous, "pathwayVotes/inactive-vote")));
    await assertSucceeds(getDoc(doc(voteOwner, "pathwayVotes/inactive-vote")));
    await assertFails(getDoc(doc(anonymous, "replies/withdrawn-reply")));
    await assertSucceeds(getDoc(doc(replyOwner, "replies/withdrawn-reply")));
  });

  it("keeps nominations and published Takes public when activity is private", async () => {
    const database = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(database, "nominations/public-nomination")));
    await assertSucceeds(getDoc(doc(database, "takes/public-take")));
  });

  it("never exposes server role assignments", async () => {
    const owner = environment.authenticatedContext("fan-private").firestore();
    await assertFails(getDoc(doc(owner, "roleAssignments/fan-private")));
  });

  it("denies trusted writes from fans, creators, and claimed admins", async () => {
    const fan = environment.authenticatedContext("fan-private").firestore();
    const creator = environment
      .authenticatedContext("creator", { approvedCreator: true })
      .firestore();
    const claimedAdmin = environment.authenticatedContext("admin", { admin: true }).firestore();

    await assertFails(setDoc(doc(fan, "takes/published_fan-private"), { uid: "fan-private" }));
    await assertFails(setDoc(doc(creator, "sources/evidence"), { projectId: "published" }));
    await assertFails(setDoc(doc(creator, "follows/history"), { uid: "creator" }));
    await assertFails(
      setDoc(doc(claimedAdmin, "roleAssignments/admin"), { roles: { admin: true } }),
    );
    await assertFails(
      setDoc(doc(claimedAdmin, "projects/published"), { publicationStatus: "published" }),
    );
  });
});

describe("Storage public/private boundary", () => {
  it("allows public reads and owner-only private reads", async () => {
    const anonymous = environment.unauthenticatedContext().storage();
    const owner = environment.authenticatedContext("fan-private").storage();
    const other = environment.authenticatedContext("fan-public").storage();
    await assertSucceeds(getBytes(ref(anonymous, "public/scout-cards/poster.txt")));
    await assertSucceeds(getBytes(ref(owner, "private/fan-private/claim-proof.txt")));
    await assertFails(getBytes(ref(other, "private/fan-private/claim-proof.txt")));
  });

  it("denies all direct client uploads", async () => {
    const owner = environment.authenticatedContext("fan-private").storage();
    await assertFails(
      uploadBytes(ref(owner, "private/fan-private/new-proof.txt"), new Uint8Array([3])),
    );
    await assertFails(uploadBytes(ref(owner, "public/new-poster.txt"), new Uint8Array([4])));
  });
});
