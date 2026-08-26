import { readFile } from "node:fs/promises";

import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GOOGLE_CLOUD_PROJECT || "audience-take-demo";
const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

if (!usingEmulator && process.env.ALLOW_DEMO_SEED !== "true") {
  throw new Error(
    "Refusing to seed a non-emulated project. Set ALLOW_DEMO_SEED=true only for an approved demo environment.",
  );
}

const records = JSON.parse(
  await readFile(new URL("./demo-accounts.example.json", import.meta.url), "utf8"),
);
const app = initializeApp({
  ...(usingEmulator ? {} : { credential: applicationDefault() }),
  projectId,
});
const database = getFirestore(app);
const batch = database.batch();

for (const record of records) {
  const timestamps = {
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  batch.set(database.collection("users").doc(record.uid), {
    ...record.profile,
    ...timestamps,
  });
  batch.set(database.collection("roleAssignments").doc(record.uid), {
    ...record.roleAssignment,
    demoOnly: true,
    ...timestamps,
  });
  batch.set(database.collection("handles").doc(record.profile.handle), {
    uid: record.uid,
    demoOnly: true,
    ...timestamps,
  });
}

await batch.commit();
console.log(`Seeded ${records.length} labeled demo profiles into ${projectId}.`);
