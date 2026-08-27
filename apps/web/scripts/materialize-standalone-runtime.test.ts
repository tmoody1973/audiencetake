import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error The production helper is intentionally executed as native ESM.
import { materializeStandaloneRuntime } from "./materialize-standalone-runtime.mjs";

const temporaryDirectories: string[] = [];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "audience-take-standalone-"));
  temporaryDirectories.push(root);
  const appRoot = join(root, "app");
  const dependencyRoot = join(root, "external", "node_modules");
  const standaloneRoot = join(appRoot, ".next", "standalone");

  mkdirSync(standaloneRoot, { recursive: true });
  writeFileSync(join(standaloneRoot, "server.js"), "require('next')\n");
  writeFileSync(
    join(appRoot, "package.json"),
    JSON.stringify({ dependencies: { next: "1.0.0", runtime: "1.0.0" } }),
  );
  writeFileSync(
    join(appRoot, "package-lock.json"),
    JSON.stringify({
      packages: {
        "node_modules/next": { version: "1.0.0" },
        "node_modules/runtime": { version: "1.0.0" },
        "node_modules/test-only": { version: "1.0.0", dev: true },
      },
    }),
  );

  for (const packageName of ["next", "runtime", "test-only"]) {
    const packageRoot = join(dependencyRoot, packageName);
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(join(packageRoot, "package.json"), JSON.stringify({ name: packageName }));
  }

  return { appRoot, dependencyRoot, standaloneRoot };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("materializeStandaloneRuntime", () => {
  it("copies the production closure from an external dependency layer", () => {
    const paths = fixture();
    const result = materializeStandaloneRuntime(paths);

    expect(result).toEqual({ copiedPackages: 2, skipped: false });
    expect(
      JSON.parse(
        readFileSync(join(paths.standaloneRoot, "node_modules", "next", "package.json"), "utf8"),
      ),
    ).toEqual({ name: "next" });
    expect(
      JSON.parse(
        readFileSync(join(paths.standaloneRoot, "node_modules", "runtime", "package.json"), "utf8"),
      ),
    ).toEqual({ name: "runtime" });
    expect(() =>
      readFileSync(join(paths.standaloneRoot, "node_modules", "test-only", "package.json")),
    ).toThrow();
  });

  it("skips normal builds that do not emit a standalone server", () => {
    const paths = fixture();
    rmSync(join(paths.standaloneRoot, "server.js"));

    expect(materializeStandaloneRuntime(paths)).toEqual({ copiedPackages: 0, skipped: true });
  });
});
