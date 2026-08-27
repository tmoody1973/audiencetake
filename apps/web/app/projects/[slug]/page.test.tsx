import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadPublishedScoutCard } = vi.hoisted(() => ({ loadPublishedScoutCard: vi.fn() }));

vi.mock("../../../features/scout-card/data", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../features/scout-card/data")>(),
  loadPublishedScoutCard,
}));

import { getScoutCardFixture } from "../../../features/scout-card/data";
import { dynamic, generateMetadata } from "./page";

describe("project Scout Card route", () => {
  beforeEach(() => {
    loadPublishedScoutCard.mockReset();
    loadPublishedScoutCard.mockResolvedValue(getScoutCardFixture("complete"));
  });

  it("forces request-time rendering for the latest published pointer", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("publishes project-specific canonical and social metadata", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "junichiro-jackson" }) });
    expect(metadata.title).toBe("Junichiro Jackson Scout Card");
    expect(metadata.alternates?.canonical).toBe("/projects/junichiro-jackson");
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      title: "Junichiro Jackson Scout Card",
      url: "/projects/junichiro-jackson",
    });
    expect(metadata.description).toContain("three bounded pathway hypotheses");
    expect(loadPublishedScoutCard).toHaveBeenCalledWith("junichiro-jackson");
  });

  it("keeps unknown cards out of search metadata", async () => {
    loadPublishedScoutCard.mockResolvedValue(null);
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "not-a-card" }) });
    expect(metadata.title).toBe("Scout Card not found");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it("marks the saved fallback noindex and describes the unavailable refresh", async () => {
    loadPublishedScoutCard.mockResolvedValue(getScoutCardFixture("fallback"));
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "junichiro-jackson" }) });
    expect(metadata.title).toBe("Junichiro Jackson saved Scout Card");
    expect(metadata.description).toContain("Previously generated — live refresh unavailable.");
    expect(metadata.description).not.toContain("Read the cited complete Scout Card");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });
});
