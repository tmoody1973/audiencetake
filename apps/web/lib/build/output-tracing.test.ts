import { describe, expect, it } from "vitest";
import { resolve } from "node:path";

import { resolveOutputFileTracingRoot } from "./output-tracing";

describe("resolveOutputFileTracingRoot", () => {
  const appRoot = "/workspace/apps/web";

  it.each(["true", "1"])(
    "roots Firebase standalone builds at the web app for flag %s",
    (standaloneFlag) => {
      expect(resolveOutputFileTracingRoot(appRoot, standaloneFlag)).toBe(appRoot);
    },
  );

  it("roots normal monorepo builds at the workspace", () => {
    expect(resolveOutputFileTracingRoot(appRoot, undefined)).toBe(
      resolve(appRoot, "../.."),
    );
  });
});
