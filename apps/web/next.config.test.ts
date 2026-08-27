import { createRequire } from "node:module";
import { relative } from "node:path";

import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

type TraceResult = { fileList: Set<string> };
type NodeFileTrace = (entries: string[], options: { base: string; moduleSyncCatchall: boolean }) => Promise<TraceResult>;

const require = createRequire(import.meta.url);

describe("Next.js deployment tracing", () => {
  it("traces the complete Next node environment from the monorepo root", async () => {
    const tracingRoot = nextConfig.outputFileTracingRoot;
    expect(tracingRoot).toEqual(expect.any(String));

    const nodeEnvironment = require.resolve("next/dist/server/node-environment");
    const baseline = require.resolve("next/dist/server/node-environment-baseline");
    const { nodeFileTrace } = require("next/dist/compiled/@vercel/nft") as { nodeFileTrace: NodeFileTrace };
    const { fileList } = await nodeFileTrace([nodeEnvironment], {
      base: tracingRoot as string,
      moduleSyncCatchall: true,
    });

    expect(fileList).toContain(relative(tracingRoot as string, baseline));
  });
});
