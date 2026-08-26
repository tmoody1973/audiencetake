import type { Metadata } from "next";
import Link from "next/link";

import { ArrowIcon, EyeIcon, MegaphoneIcon, SearchIcon, TicketIcon } from "../components/icons";
import { SiteHeader } from "../components/site-header";

export const metadata: Metadata = {
  title: "The audience’s take on what should be made next",
  description:
    "Find an overlooked screen story, nominate its public URL, and watch agents turn current public evidence into a Scout Card.",
};

const steps = [
  { title: "Nominate", body: "Share one public project link and tell us why the story deserves a wider look.", icon: TicketIcon },
  { title: "Agents scout", body: "Visible agents read the source, search the public web, check evidence, and cite what they find.", icon: SearchIcon },
  { title: "Audience takes action", body: "A public Scout Card gives fans useful ways to follow, respond, and champion the next step.", icon: MegaphoneIcon },
];

const selects = [
  { title: "A local story with a wider horizon", type: "Editorial example", reason: "Selected to show how a distinctive storyworld could be surfaced.", color: "yellow" },
  { title: "A short built for its next chapter", type: "Demo project", reason: "Selected to demonstrate an early-evidence research state.", color: "blue" },
  { title: "An unfinished signal worth following", type: "Editorial fallback", reason: "Selected to show that partial truth stays visibly partial.", color: "coral" },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero" aria-labelledby="mission-title">
          <div className="hero-mission paper-texture">
            <div className="hero-side-note" aria-hidden="true"><span>Audience take</span><span>Public scouting</span></div>
            <div className="hero-copy">
              <h1 id="mission-title">Fans can find the next great screen story <em>first.</em></h1>
              <p>The audience’s take on what should be made next. Surface an overlooked public project, then watch cited research turn it into something people can act on.</p>
            </div>
            <div className="trust-stamp"><EyeIcon /><span>Public sources. Clear labels. No mystery score.</span></div>
          </div>

          <div className="nomination-ticket paper-texture">
            <span className="ticket-hole" aria-hidden="true" />
            <span className="ticket-notch ticket-notch-top" aria-hidden="true" />
            <span className="ticket-notch ticket-notch-bottom" aria-hidden="true" />
            <span className="ticket-crop ticket-crop-top" aria-hidden="true" />
            <span className="ticket-crop ticket-crop-bottom" aria-hidden="true" />
            <span className="ticket-edge" aria-hidden="true">AT / OPEN CALL / 001</span>
            <div className="ticket-heading"><h2>Nominate a project</h2><span aria-hidden="true"><ArrowIcon /></span></div>
            <p>Found a trailer, short, series, documentary, creator page, or public campaign?</p>
            <form action="/nominate" method="get" className="quick-form">
              <label htmlFor="project-url">Public project URL</label>
              <input id="project-url" name="url" type="url" inputMode="url" autoComplete="url" placeholder="https://youtube.com/watch?v=…" required />
              <button type="submit">Start a nomination <ArrowIcon /></button>
            </form>
            <p className="ticket-note">Takes about two minutes. Sign-in is required before research begins.</p>
            <div className="ticket-perforation" aria-hidden="true" />
          </div>
        </section>

        <section className="featured-strip" aria-labelledby="featured-title">
          <div className="featured-details">
            <h2 id="featured-title">Junichiro Jackson</h2>
            <span className="featured-label">Featured nomination · source 01</span>
            <p className="claim-label">Fan nomination — unclaimed by creator</p>
            <p className="featured-summary">See the supplied public source, then follow how a nomination becomes a cited Scout Card. No creator endorsement is implied.</p>
            <a className="button button-inverse" href="https://www.youtube.com/watch?v=M2djoKmnOTY">Open public source <ArrowIcon /></a>
          </div>
          <div className="source-frame">
            <iframe src="https://www.youtube-nocookie.com/embed/M2djoKmnOTY" title="Junichiro Jackson public project video on YouTube" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
          </div>
          <aside className="source-receipt" aria-label="Source status"><span>Source</span><strong>YouTube</strong><span>Card status</span><strong>Preview</strong><span>Creator claim</span><strong>Unclaimed</strong></aside>
        </section>

        <section className="workflow" aria-labelledby="workflow-title">
          <div className="workflow-program">
            <header className="workflow-summary"><h2 id="workflow-title">One link becomes a public object.</h2><p>Evidence, inference, and audience opinion keep their own labels.</p></header>
            <ol className="workflow-list">
              {steps.map((step, index) => { const Icon = step.icon; return <li key={step.title}><span className="step-number">0{index + 1}</span><Icon /><div><h3>{step.title}</h3><p>{step.body}</p></div></li>; })}
            </ol>
          </div>
          <div className="workflow-cta">
            <div className="handoff-motion" aria-label="A nomination advances from URL to research to Scout Card"><span>URL</span><ArrowIcon /><span>Research</span><ArrowIcon /><span>Scout Card</span></div>
            <p><strong>Transparent by design.</strong> Browsing stays public; participation starts after sign-in.</p>
            <Link href="/nominate" className="text-link">Nominate <ArrowIcon /></Link>
          </div>
        </section>

        <section className="selects" id="selects" aria-labelledby="selects-title">
          <header className="selects-header"><div><h2 id="selects-title">The Selects</h2><p>An editorial program, not a leaderboard. Every placement says why it is here.</p></div><span className="selects-note">Preview collection · demo entries</span></header>
          <div className="selects-rail">
            {selects.map((item, index) => <article className={`select-entry select-entry-${index + 1}`} key={item.title}><div className={`editorial-poster poster-${item.color}`} aria-hidden="true"><span>{String(index + 1).padStart(2, "0")}</span><i /><b>AT</b></div><div className="select-copy"><span>{item.type}</span><h3>{item.title}</h3><p>{item.reason}</p><span className="select-status">Sample — no audience activity claimed</span></div></article>)}
          </div>
        </section>
      </main>
      <footer className="site-footer"><strong>Audience Take</strong><p>Find it early. Scout it in public. Give the next story a real next step.</p><Link href="/nominate">Nominate a project <ArrowIcon /></Link></footer>
    </>
  );
}
