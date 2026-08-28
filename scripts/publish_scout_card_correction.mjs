#!/usr/bin/env node

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { createServer } from "vite";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(repositoryRoot, "apps", "web");

function usage() {
  return `Usage:
  node scripts/publish_scout_card_correction.mjs \\
    --project <firebase-project> --project-id <document-id> \\
    --expected-card <card-version-id> --source-url <youtube-url> \\
    --source-title <title> --author-name <name> --card-title <title> \\
    --summary <public-summary> --prior-basis <public-prior-basis> \\
    [--actor-uid <private-audit-label>] [--apply]

Without --apply, the command only validates input and reads the current pointer.
With --apply, --actor-uid is required and the immutable transaction is committed.`;
}

function parseArguments(values) {
  const result = { apply: false };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--apply") {
      result.apply = true;
      continue;
    }
    if (value === "--help" || value === "-h") {
      result.help = true;
      continue;
    }
    if (!value.startsWith("--") || !values[index + 1]) throw new Error(`Invalid argument: ${value}`);
    result[value.slice(2)] = values[index + 1];
    index += 1;
  }
  return result;
}

const args = parseArguments(process.argv.slice(2));
if (args.help) {
  console.log(usage());
  process.exit(0);
}

const required = [
  "project", "project-id", "expected-card", "source-url", "source-title",
  "author-name", "card-title", "summary", "prior-basis",
];
const missing = required.filter((name) => !args[name]);
if (args.apply && !args["actor-uid"]) missing.push("actor-uid");
if (missing.length) throw new Error(`Missing required arguments: ${missing.join(", ")}\n\n${usage()}`);

const vite = await createServer({
  root: webRoot,
  configFile: false,
  server: { middlewareMode: true },
  resolve: { alias: { "@": webRoot } },
  appType: "custom",
  logLevel: "error",
});

try {
  const { correctionInputSchema, recordProjectCorrection } = await vite.ssrLoadModule("/lib/trust/corrections.ts");
  const input = correctionInputSchema.parse({
    section: "media",
    summary: args.summary,
    priorBasis: args["prior-basis"],
    expectedCardVersionId: args["expected-card"],
    replacement: {
      kind: "youtube_primary_work",
      sourceUrl: args["source-url"],
      sourceTitle: args["source-title"],
      authorName: args["author-name"],
      cardTitle: args["card-title"],
    },
  });

  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: args.project });
  }
  const database = getFirestore();
  const projectSnapshot = await database.collection("projects").doc(args["project-id"]).get();
  const project = projectSnapshot.data();
  if (!projectSnapshot.exists || project?.publicationStatus !== "published") {
    throw new Error("Refusing: published project was not found.");
  }
  if (!args.apply && project.latestCardVersionId !== args["expected-card"]) {
    throw new Error(`Refusing: current card pointer is ${String(project.latestCardVersionId)}, not ${args["expected-card"]}.`);
  }

  if (!args.apply) {
    console.log(JSON.stringify({
      mode: "dry-run",
      projectId: args["project-id"],
      currentCardVersionId: project.latestCardVersionId,
      researchVersion: project.publishedResearchVersion,
      sourceUrl: input.replacement.sourceUrl,
      sourceTitle: input.replacement.sourceTitle,
      cardTitle: input.replacement.cardTitle,
    }, null, 2));
  } else {
    const result = await recordProjectCorrection(
      database,
      args["project-id"],
      args["actor-uid"],
      input,
    );
    console.log(JSON.stringify({ mode: "apply", ...result }, null, 2));
  }
} finally {
  await vite.close();
}
