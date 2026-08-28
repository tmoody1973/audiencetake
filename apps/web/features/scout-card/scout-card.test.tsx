import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getScoutCardFixture } from "./data";
import { ScoutCard } from "./scout-card";

afterEach(cleanup);

describe("ScoutCard", () => {
  it("renders the complete card with cited claims and exactly three pathway hypotheses", () => {
    const { container } = render(<ScoutCard card={getScoutCardFixture("complete")} />);

    expect(screen.getByRole("heading", { level: 1, name: "Junichiro Jackson" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Watch before you judge" })).toBeInTheDocument();
    expect(screen.getByLabelText("Scout Card status")).toHaveTextContent("StructurecompleteEvidenceSource limited");
    expect(screen.getByRole("heading", { name: "What we know" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What we're checking" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why this is being scouted" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add your informed Take" })).toHaveAttribute("href", "#audience-pulse");
    const overview = screen.getByLabelText("Submitted media and scouting summary");
    expect(overview.firstElementChild).toHaveClass("scout-start-here");
    expect(overview.lastElementChild).toHaveClass("evidence-brief");
    expect(container.querySelector(".evidence-brief")?.children).toHaveLength(4);
    const pathways = screen.getByRole("heading", { name: "Pathway hypotheses" }).closest("section");
    expect(pathways).not.toBeNull();
    expect(within(pathways as HTMLElement).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByText("[S1]", { selector: ".citation-marks" })).toHaveLength(8);
    expect(screen.getByRole("link", { name: "Junichiro Jackson public project video" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=M2djoKmnOTY");
    expect(screen.getByText(/No native audience count is claimed\./)).toBeInTheDocument();
    const audiencePulse = container.querySelector("#audience-pulse");
    const industryLens = container.querySelector(".industry-lens");
    expect(audiencePulse).not.toBeNull();
    expect(industryLens).not.toBeNull();
    if (!audiencePulse || !industryLens) throw new Error("Expected both ordered Scout Card sections.");
    expect(audiencePulse.compareDocumentPosition(industryLens) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("turns additional available YouTube sources into a bounded, accessible carousel", () => {
    const card = structuredClone(getScoutCardFixture("complete"));
    card.sourceLedger.push({
      id: "source-youtube-community-video",
      origin: "community_lead",
      title: "Additional Junichiro Jackson video",
      url: "https://www.youtube.com/watch?v=s8G7425lfKs&list=RDs8G7425lfKs",
      publishedAt: null,
      retrievedAt: "2026-08-27T12:00:00Z",
      availability: "available",
      verificationStatus: "observed",
      supportsClaimIds: [],
      externalCommentary: false,
    });

    render(<ScoutCard card={card} />);

    expect(screen.getByLabelText("Source video carousel, 2 videos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous source video" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Show source video 2: Additional Junichiro Jackson video" }));
    const player = screen.getByTitle("Additional Junichiro Jackson video");
    expect(player).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/s8G7425lfKs");
    expect(player.parentElement).toHaveClass("source-video-viewport");
    expect(screen.getByText("Community lead / Observed source")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next source video" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Open source video" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=s8G7425lfKs&list=RDs8G7425lfKs");
    expect(screen.getByTitle("Additional Junichiro Jackson video")).not.toHaveAttribute("allow", expect.stringContaining("autoplay"));
  });

  it("keeps the comparative Industry Lens collapsed until a reader expands it", () => {
    const { container } = render(<ScoutCard card={getScoutCardFixture("complete")} />);
    const disclosure = container.querySelector(".industry-lens details");
    expect(disclosure).not.toHaveAttribute("open");

    fireEvent.click(screen.getByText("Industry Lens — comparative view"));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByRole("table", { name: "Industry Lens comparison of the three pathway hypotheses" })).toBeInTheDocument();
  });

  it("renders the bounded timestamped Trailer Critic artifact", () => {
    const card = structuredClone(getScoutCardFixture("complete"));
    card.trailerCritiques = [{
      artifactId: "video-analysis-1", projectId: card.projectId,
      sourceId: "source-youtube-trailer", youtubeUrl: "https://www.youtube.com/watch?v=M2djoKmnOTY",
      youtubeVideoId: "M2djoKmnOTY", modelId: "gemini-3.7-flash", analysisVersion: 1,
      cardVersionId: card.cardVersionId, analyzedAt: "2026-08-28T12:00:00Z", visibility: "public",
      structuralNarrative: {
        genreSignaling: "The trailer signals an urban supernatural action story.",
        narrativeDelivery: "A vignette prioritizes tone over plot summary.", trailerType: "Proof of concept.",
        beats: [
          { label: "Hook", start: "00:00", end: "00:30", observation: "A measured opening establishes mood.", modality: "audiovisual" },
          { label: "Turn", start: "00:31", end: "01:00", observation: "The pace pivots into action.", modality: "visual" },
        ],
      },
      technicalCraft: { editingAndPace: "Contrasting rhythms.", cinematographyAndFraming: "Low angles.", soundAndScore: "Rhythmic impacts.", graphicsAndTitles: "A closing title sting." },
      marketingPersuasion: { uniqueSellingProposition: "A critic hypothesis about the genre blend.", targetAudienceHypothesis: "May appeal to adult animation viewers.", conceptVsStarEmphasis: "Concept-led.", representationCaveat: "A trailer cannot establish full-project consistency." },
      emotionalRhetorical: { emotionalHook: "Curiosity before action.", toneAndMoodBalance: "Dark action and humor.", persuasiveArgument: "Execution argues for development." },
      matrix: [
        { category: "genre", analysis: "Occult action." }, { category: "narrative_stance", analysis: "Micro-vignette." },
        { category: "usp", analysis: "Hybrid vocabulary." }, { category: "target_audience", analysis: "Critic hypothesis." },
        { category: "sound_music", analysis: "Rhythmic contrast." }, { category: "camera_editing", analysis: "Kinetic montage." },
      ],
      sourceIds: ["source-youtube-trailer"],
      limitations: ["Gemini samples the video; this is not frame-perfect inspection."],
    }];

    render(<ScoutCard card={card} />);

    expect(screen.getByRole("heading", { name: "Trailer critic" })).toBeInTheDocument();
    expect(screen.getByText("Genre")).toBeInTheDocument();
    expect(screen.getByText("Form")).toBeInTheDocument();
    const disclosure = screen.getByText("Show full analysis").closest("details");
    expect(disclosure).not.toBeNull();
    expect(disclosure).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Show full analysis"));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByText("00:00–00:30")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Critic's breakdown matrix" })).toBeInTheDocument();
    expect(screen.getByText(/not frame-perfect inspection/)).toBeInTheDocument();
  });

  it("announces a Partial card and names its missing research sections", () => {
    render(<ScoutCard card={getScoutCardFixture("partial")} />);
    expect(screen.getByRole("status")).toHaveTextContent("Partial Scout Card");
    expect(screen.getByText("parallel web sources / verified comparables")).toBeInTheDocument();
  });

  it("shows an accessible non-player state when submitted media is unavailable", () => {
    render(<ScoutCard card={getScoutCardFixture("unavailable")} />);
    expect(screen.queryByTitle("Watch the submitted Junichiro Jackson source video")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Submitted Junichiro Jackson source video unavailable" })).toHaveTextContent("Media is unavailable");
  });

  it("labels a saved fallback without implying a live refresh", () => {
    render(<ScoutCard card={getScoutCardFixture("fallback")} />);
    expect(screen.getByRole("status")).toHaveTextContent("Previously generated — live refresh unavailable.");
  });

  it("rejects malformed cards that do not contain exactly three pathways", () => {
    const card = structuredClone(getScoutCardFixture("complete"));
    card.pathways.pop();
    expect(() => render(<ScoutCard card={card} />)).toThrow("exactly three pathways");
  });
});
