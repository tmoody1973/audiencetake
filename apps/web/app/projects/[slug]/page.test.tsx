import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadPublishedScoutCard, notFound, permanentRedirect } = vi.hoisted(() => ({
  loadPublishedScoutCard: vi.fn(),
  notFound: vi.fn(),
  permanentRedirect: vi.fn(),
}));

vi.mock("../../../features/scout-card/data", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../features/scout-card/data")>(),
  loadPublishedScoutCard,
}));
vi.mock("next/navigation", () => ({ notFound, permanentRedirect }));

import {
  getScoutCardFixture,
  JUNICHIO_LIVE_SLUG,
  JUNICHIO_SLUG,
} from "../../../features/scout-card/data";
import ProjectPage, { dynamic, generateMetadata } from "./page";

describe("project Scout Card route", () => {
  beforeEach(() => {
    loadPublishedScoutCard.mockReset();
    notFound.mockReset();
    permanentRedirect.mockReset();
    permanentRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    loadPublishedScoutCard.mockResolvedValue(getScoutCardFixture("complete"));
  });

  it("forces request-time rendering for the latest published pointer", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("redirects the memorable Junichiro demo alias without loading or rewriting the stored card", async () => {
    await expect(ProjectPage({ params: Promise.resolve({ slug: JUNICHIO_SLUG }) }))
      .rejects.toThrow("NEXT_REDIRECT");

    expect(permanentRedirect).toHaveBeenCalledWith(`/projects/${JUNICHIO_LIVE_SLUG}`);
    expect(loadPublishedScoutCard).not.toHaveBeenCalled();
  });

  it("keeps the redirect alias out of search results and points metadata at the verified route", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: JUNICHIO_SLUG }) });

    expect(metadata.alternates?.canonical).toBe(`/projects/${JUNICHIO_LIVE_SLUG}`);
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(loadPublishedScoutCard).not.toHaveBeenCalled();
  });

  it("publishes project-specific canonical and social metadata", async () => {
    const liveCard = structuredClone(getScoutCardFixture("complete"));
    liveCard.slug = JUNICHIO_LIVE_SLUG;
    liveCard.title = "Junichiro Live Project";
    loadPublishedScoutCard.mockResolvedValue(liveCard);
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: JUNICHIO_LIVE_SLUG }) });
    expect(metadata.title).toBe("Junichiro Live Project Scout Card");
    expect(metadata.alternates?.canonical).toBe(`/projects/${JUNICHIO_LIVE_SLUG}`);
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      title: "Junichiro Live Project Scout Card",
      url: `/projects/${JUNICHIO_LIVE_SLUG}`,
    });
    expect(metadata.description).toContain("three bounded pathway hypotheses");
    expect(loadPublishedScoutCard).toHaveBeenCalledWith(JUNICHIO_LIVE_SLUG);
  });

  it("keeps unknown cards out of search metadata", async () => {
    loadPublishedScoutCard.mockResolvedValue(null);
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "not-a-card" }) });
    expect(metadata.title).toBe("Scout Card not found");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it("marks the saved fallback noindex and describes the unavailable refresh", async () => {
    loadPublishedScoutCard.mockResolvedValue(getScoutCardFixture("fallback"));
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: JUNICHIO_LIVE_SLUG }) });
    expect(metadata.title).toBe("Junichiro Jackson saved Scout Card");
    expect(metadata.description).toContain("Previously generated — live refresh unavailable.");
    expect(metadata.description).not.toContain("Read the cited complete Scout Card");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });
});
