import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
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
      setDoc(doc(database, "events/public-event"), {
        projectId: "published",
        publicVisibility: true,
        publicTitle: "Scouting public sources",
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
      setDoc(doc(database, "nominations/public-nomination"), {
        nominatorUid: "fan-private",
        visibility: "public",
      }),
      setDoc(doc(database, "takes/public-take"), {
        uid: "fan-private",
        projectId: "published",
        status: "published",
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
    await assertFails(getDoc(doc(database, "researchRuns/private-run")));
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
    const owner = environment.authenticatedContext("fan-private").firestore();
    await assertFails(getDoc(doc(anonymous, "follows/private-follow")));
    await assertSucceeds(getDoc(doc(owner, "follows/private-follow")));
    await assertSucceeds(getDoc(doc(anonymous, "follows/public-follow")));
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
