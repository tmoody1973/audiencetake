import { describe, expect, it } from "vitest";

import { sanitizeReturnTo } from "./return-to";

describe("sanitizeReturnTo", () => {
  it("keeps safe same-origin application paths", () => {
    expect(sanitizeReturnTo("/projects/junichiro-jackson?claim=1#takes")).toBe(
      "/projects/junichiro-jackson?claim=1#takes",
    );
  });

  it.each(["https://malicious.test", "//malicious.test", "javascript:alert(1)", "  /admin"])(
    "rejects unsafe return target %s",
    (value) => {
      expect(sanitizeReturnTo(value)).toBe("/");
    },
  );
});
