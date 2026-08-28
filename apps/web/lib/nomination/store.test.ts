import { describe, expect, it } from "vitest";

import { projectSlugFromId } from "./store";

describe("projectSlugFromId", () => {
  it("normalizes mixed-case Firestore auto IDs for the agent route contract", () => {
    expect(projectSlugFromId("vSU2DLAPidOArl8MbA5E")).toBe("project-vsu2dlapid");
  });
});
