import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScoutingWallEntry } from "../../features/scouting-wall/data";

const mocks = vi.hoisted(() => ({ loadScoutingWallEntries: vi.fn() }));
vi.mock("../../features/scouting-wall/data", () => ({ loadScoutingWallEntries: mocks.loadScoutingWallEntries }));
vi.mock("../../components/site-header", () => ({ SiteHeader: () => <div>Header</div> }));

import ProjectsPage from "./page";

const entry: ScoutingWallEntry = {
  accessionId: "card-one-v1",
  projectId: "project-one",
  slug: "project-one",
  title: "Project One",
  hook: "A public story looking for its next form.",
  projectType: "film",
  submissionLabel: "Fan nomination",
  claimStatus: "unclaimed",
  completeness: "complete",
  evidenceStatus: "source_limited",
  publishedAt: "2026-08-27T20:00:00.000Z",
  sourceCount: 3,
  pathwayLabels: ["Feature", "Series", "Short proof"],
  audiencePulse: {
    follows: 12,
    wouldWatch: 7,
    wouldPay: 2,
    bringToCity: 1,
    backNextChapter: 4,
  },
};

describe("Scouting Wall page", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("links every validated entry to its public Scout Card", async () => {
    mocks.loadScoutingWallEntries.mockResolvedValue([entry]);
    render(await ProjectsPage());

    expect(screen.getByRole("heading", { name: "Scouting Wall" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Project One Scout Card" })).toHaveAttribute("href", "/projects/project-one");
    expect(screen.getByText("Source limited")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Audience Pulse organic participation signals" })).toBeInTheDocument();
    expect(screen.getByLabelText("Follow: 12")).toBeInTheDocument();
    expect(screen.getByText("01 card")).toBeInTheDocument();
  });

  it("renders an honest empty state instead of demo cards", async () => {
    mocks.loadScoutingWallEntries.mockResolvedValue([]);
    render(await ProjectsPage());
    expect(screen.getByRole("heading", { name: /No public Scout Cards/i })).toBeInTheDocument();
    expect(screen.queryByText("Project One")).not.toBeInTheDocument();
  });
});
