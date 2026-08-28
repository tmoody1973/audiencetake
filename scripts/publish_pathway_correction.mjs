#!/usr/bin/env node

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { createServer } from "vite";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(repositoryRoot, "apps", "web");

function usage() {
  return `Usage:
  node scripts/publish_pathway_correction.mjs \\
    --project <firebase-project> --project-id <document-id> --input <correction.json> \\
    [--actor-uid <private-audit-label>] [--apply]

The JSON file must satisfy the project_native_pathways correction contract.
Without --apply, the command only validates the file and reads the current project pointer.
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
    if (!value.startsWith("--") || !values[index + 1]) {
      throw new Error(`Invalid argument: ${value}`);
    }
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
const required = ["project", "project-id", "input"];
const missing = required.filter((name) => !args[name]);
if (args.apply && !args["actor-uid"]) missing.push("actor-uid");
if (missing.length) throw new Error(`Missing required arguments: ${missing.join(", ")}\n\n${usage()}`);

const rawInput = JSON.parse(await readFile(path.resolve(args.input), "utf8"));
const vite = await createServer({
  root: webRoot,
  configFile: false,
  server: { middlewareMode: true },
  resolve: { alias: { "@": webRoot } },
  appType: "custom",
  logLevel: "error",
});

try {
  const {
    correctionInputSchema,
    recordProjectCorrection,
    validateProjectNativePathwayCorrection,
  } = await vite.ssrLoadModule(
    "/lib/trust/corrections.ts",
  );
  const { parsePublishedCard } = await vite.ssrLoadModule("/features/scout-card/data.ts");
  const input = correctionInputSchema.parse(rawInput);
  if (!("replacement" in input) || input.replacement.kind !== "project_native_pathways") {
    throw new Error("Input must use replacement.kind=project_native_pathways.");
  }
  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: args.project });
  }
  const database = getFirestore();
  const projectSnapshot = await database.collection("projects").doc(args["project-id"]).get();
  const project = projectSnapshot.data();
  if (!projectSnapshot.exists || project?.publicationStatus !== "published") {
    throw new Error("Refusing: published project was not found.");
  }
  if (project.latestCardVersionId !== input.expectedCardVersionId) {
    throw new Error(
      `Refusing: current card pointer is ${String(project.latestCardVersionId)}, not ${input.expectedCardVersionId}.`,
    );
  }
  const cardSnapshot = await database.collection("scoutCards").doc(input.expectedCardVersionId).get();
  const card = cardSnapshot.exists
    ? parsePublishedCard(cardSnapshot.data(), {
        cardVersionId: input.expectedCardVersionId,
        projectId: args["project-id"],
        slug: typeof project.slug === "string" ? project.slug : "",
      })
    : null;
  if (!card) throw new Error("Refusing: current Scout Card does not satisfy its public contract.");
  validateProjectNativePathwayCorrection(card, input);

  if (!args.apply) {
    console.log(JSON.stringify({
      mode: "dry-run",
      projectId: args["project-id"],
      currentCardVersionId: project.latestCardVersionId,
      researchVersion: project.publishedResearchVersion,
      projectProfile: input.replacement.projectProfile,
      pathways: input.replacement.pathways.map(({ id, order, label, format, strategyKind }) => ({
        id, order, label, format, strategyKind,
      })),
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
