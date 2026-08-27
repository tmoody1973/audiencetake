import { cpSync, existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function findDependencyRoot(appRoot, searchPath = process.env.PATH ?? "") {
  const require = createRequire(import.meta.url);

  try {
    return dirname(dirname(require.resolve("next/package.json", { paths: [appRoot] })));
  } catch {
    for (const pathEntry of searchPath.split(delimiter)) {
      if (!pathEntry || dirname(pathEntry) === pathEntry) continue;
      const candidate = dirname(pathEntry);
      if (existsSync(join(candidate, "next", "package.json"))) return candidate;
    }
  }

  throw new Error("Could not locate the installed Next.js dependency root.");
}

export function materializeStandaloneRuntime({
  appRoot,
  dependencyRoot = findDependencyRoot(appRoot),
  standaloneRoot = join(appRoot, ".next", "standalone"),
}) {
  if (!existsSync(join(standaloneRoot, "server.js"))) {
    return { copiedPackages: 0, skipped: true };
  }

  const manifest = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(appRoot, "package-lock.json"), "utf8"));
  const packageEntries = Object.entries(lock.packages ?? {})
    .filter(([packagePath, metadata]) => packagePath.startsWith("node_modules/") && metadata.dev !== true)
    .sort(([left], [right]) => left.localeCompare(right));

  let copiedPackages = 0;
  for (const [packagePath] of packageEntries) {
    const relativePackagePath = packagePath.slice("node_modules/".length);
    const source = join(dependencyRoot, relativePackagePath);
    if (!existsSync(source)) continue;

    cpSync(source, join(standaloneRoot, "node_modules", relativePackagePath), {
      recursive: true,
      dereference: true,
      force: true,
    });
    copiedPackages += 1;
  }

  const missingDirectDependencies = Object.keys(manifest.dependencies ?? {}).filter(
    (packageName) => !existsSync(join(standaloneRoot, "node_modules", packageName, "package.json")),
  );
  if (missingDirectDependencies.length > 0) {
    throw new Error(
      `Standalone runtime is missing direct dependencies: ${missingDirectDependencies.join(", ")}`,
    );
  }

  console.log(`Materialized ${copiedPackages} production packages in the standalone runtime.`);
  return { copiedPackages, skipped: false };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  materializeStandaloneRuntime({ appRoot: process.cwd() });
}
