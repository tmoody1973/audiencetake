import type { Metadata } from "next";
import Link from "next/link";

import { ArrowIcon } from "../../components/icons";
import { SiteHeader } from "../../components/site-header";
import {
  loadScoutingWallEntries,
  type ScoutingWallEntry,
} from "../../features/scouting-wall/data";
import { AudiencePulseStrip } from "../../features/scouting-wall/audience-pulse-strip";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scouting Wall",
  description: "Browse published Audience Take Scout Cards and inspect their evidence status, pathways, and public sources.",
  alternates: { canonical: "/projects" },
};

const projectTypeLabels: Record<ScoutingWallEntry["projectType"], string> = {
  series: "Series",
  film: "Film",
  short_film: "Short film",
  documentary: "Documentary",
  creator_project: "Creator project",
};

const evidenceLabels: Record<ScoutingWallEntry["evidenceStatus"], string> = {
  verified_core: "Verified core",
  verification_in_progress: "Verification in progress",
  source_limited: "Source limited",
  conflicting: "Conflicting evidence",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function WallCard({ entry, index }: { entry: ScoutingWallEntry; index: number }) {
  return (
    <li className="wall-cell">
      <Link href={`/projects/${entry.slug}`} aria-label={`Open ${entry.title} Scout Card`}>
        <article>
          <div className="wall-cell-poster" aria-hidden="true">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <i />
            <strong>AT</strong>
          </div>
          <div className="wall-cell-copy">
            <div className="wall-cell-kicker"><span>{projectTypeLabels[entry.projectType]}</span><span>{entry.submissionLabel}</span></div>
            <h2>{entry.title}</h2>
            <p>{entry.hook}</p>
            <dl>
              <div><dt>Evidence</dt><dd>{evidenceLabels[entry.evidenceStatus]}</dd></div>
              <div><dt>Structure</dt><dd>{entry.completeness}</dd></div>
              <div><dt>Sources</dt><dd>{entry.sourceCount}</dd></div>
              <div><dt>Creator</dt><dd>{entry.claimStatus}</dd></div>
            </dl>
            <ol className="wall-pathways" aria-label="Pathway hypotheses">
              {entry.pathwayLabels.map((label, pathwayIndex) => <li key={label}><span>0{pathwayIndex + 1}</span>{label}</li>)}
            </ol>
            <AudiencePulseStrip counts={entry.audiencePulse} />
            <footer><span>Published <time dateTime={entry.publishedAt}>{dateFormatter.format(new Date(entry.publishedAt))}</time></span><strong>Open Scout Card <ArrowIcon /></strong></footer>
          </div>
          <span className="wall-accession" aria-hidden="true">{entry.accessionId}</span>
        </article>
      </Link>
    </li>
  );
}

export default async function ProjectsPage() {
  const entries = await loadScoutingWallEntries();

  return (
    <>
      <SiteHeader />
      <main className="scouting-wall paper-texture">
        <header className="wall-masthead">
          <div><span className="route-label">Audience Take / public program 02</span><h1>Scouting Wall</h1></div>
          <div className="wall-masthead-note"><strong>Published Scout Cards</strong><p>Browse evidence-backed project pages. This is a public catalog, not a popularity ranking.</p></div>
          <Link className="button-primary" href="/nominate">Put a project on the wall <ArrowIcon /></Link>
        </header>
        <section className="wall-index" aria-labelledby="wall-index-title">
          <header><div><span>Public index</span><h2 id="wall-index-title">What the audience found</h2></div><strong>{String(entries.length).padStart(2, "0")} card{entries.length === 1 ? "" : "s"}</strong></header>
          {entries.length > 0
            ? <ol className="wall-grid">{entries.map((entry, index) => <WallCard key={entry.accessionId} entry={entry} index={index} />)}</ol>
            : <div className="wall-empty"><span>Wall awaiting publication</span><h2>No public Scout Cards are available right now.</h2><p>Published cards appear here only after their public contract and moderation state pass validation.</p><Link className="text-link" href="/nominate">Nominate the first project <ArrowIcon /></Link></div>}
        </section>
      </main>
      <footer className="site-footer"><strong>Audience Take</strong><p>Scout Cards stay project-centered, inspectable, and free of opaque ranking scores.</p><Link href="/nominate">Nominate a project <ArrowIcon /></Link></footer>
    </>
  );
}
