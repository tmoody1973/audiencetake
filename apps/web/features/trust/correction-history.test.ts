import { describe, expect, it } from "vitest";

import { initialCardVersionId } from "./correction-history";

describe("correction history", () => {
  it("walks the immutable correction chain back to the initial publication", () => {
    expect(initialCardVersionId("card-v3", [
      { fromCardVersionId: "card-v1", toCardVersionId: "card-v2" },
      { fromCardVersionId: "card-v2", toCardVersionId: "card-v3" },
    ])).toBe("card-v1");
  });

  it("keeps the current card when history contains note-only corrections", () => {
    expect(initialCardVersionId("card-v1", [{}])).toBe("card-v1");
  });
});
