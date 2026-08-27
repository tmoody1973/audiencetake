import { resolve } from "node:path";

export function resolveOutputFileTracingRoot(
  appRoot: string,
  standaloneFlag = process.env.NEXT_PRIVATE_STANDALONE,
): string {
  return standaloneFlag === "true" || standaloneFlag === "1"
    ? appRoot
    : resolve(appRoot, "../..");
}
