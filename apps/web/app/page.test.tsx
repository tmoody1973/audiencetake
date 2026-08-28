import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import HomePage from "./page";
import { NominationForm } from "./nominate/nomination-form";

describe("HomePage", () => {
  afterEach(cleanup);

  it("states the mission and exposes the URL-first nomination entry", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: /fans can find the next great screen story/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /public project url/i })).toHaveAttribute("type", "url");
    expect(screen.getByRole("button", { name: /start a nomination/i })).toBeInTheDocument();
    expect(screen.getByText("Fan nomination — unclaimed by creator")).toBeInTheDocument();
    expect(screen.getByTitle(/Junichiro Jackson public project video/i)).toHaveAttribute("src", expect.stringContaining("youtube-nocookie.com"));
  });

  it("shows the truthful three-step sequence and links the published Select to its Scout Card", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "Nominate" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agents scout" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Audience takes action" })).toBeInTheDocument();
    expect(screen.getByText(/Published Scout Card · source-limited evidence/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Complete demonstration card Junichiro Jackson/i })).toHaveAttribute("href", "/projects/junichiro-live-project");
    expect(screen.getByRole("link", { name: /Browse the Scouting Wall/i })).toHaveAttribute("href", "/projects");
  });
});

describe("NominationForm", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("validates required fields without clearing entered input", () => {
    render(<NominationForm initialUrl="https://example.com/project" />);
    fireEvent.change(screen.getByLabelText(/Why should this grow/i), { target: { value: "Too short" } });
    fireEvent.click(screen.getByRole("button", { name: /review nomination/i }));

    expect(screen.getByText(/at least 20 characters/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Why should this grow/i)).toHaveValue("Too short");
  });

  it("requires a creator connection and displays the pending label", () => {
    render(<NominationForm initialUrl="https://example.com/project" />);
    fireEvent.click(screen.getByRole("button", { name: /Submit My Project/i }));
    fireEvent.change(screen.getByLabelText(/Why should this grow/i), { target: { value: "This project has a distinctive voice worth developing." } });
    fireEvent.click(screen.getByRole("button", { name: /review nomination/i }));

    expect(screen.getByText(/Confirm your connection/i)).toBeInTheDocument();
    expect(screen.getByText(/Creator-submitted — claim not yet verified/i)).toBeInTheDocument();
  });

  it("supports five links and preserves the nomination when submission fails", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "Service unavailable." } }) }));
    render(<NominationForm initialUrl="https://example.com/project" />);
    fireEvent.change(screen.getByLabelText(/Why should this grow/i), { target: { value: "This project has a distinctive voice worth developing." } });
    for (let index = 0; index < 4; index += 1) fireEvent.click(screen.getByRole("button", { name: /add another public link/i }));
    expect(screen.getAllByPlaceholderText(/Supporting link/i)).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: /review nomination/i }));
    fireEvent.click(screen.getByRole("button", { name: /start scout research/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/still here/i));
    fireEvent.click(screen.getByRole("button", { name: /back to edit/i }));
    expect(screen.getByLabelText(/Why should this grow/i)).toHaveValue("This project has a distinctive voice worth developing.");
  });
});
