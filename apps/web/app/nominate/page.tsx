import type { Metadata } from "next";

import { SiteHeader } from "../../components/site-header";
import { NominationForm } from "./nomination-form";

export const metadata: Metadata = {
  title: "Nominate a project",
  description: "Share an overlooked public screen project and tell Audience Take why it should grow.",
};

export default async function NominatePage({ searchParams }: { searchParams: Promise<{ url?: string | string[] }> }) {
  const params = await searchParams;
  const initialUrl = typeof params.url === "string" ? params.url : "";

  return (
    <>
      <SiteHeader />
      <main className="nominate-page">
        <header className="nominate-intro paper-texture">
          <h1>Put a story on the scouting wall.</h1>
          <p>Start with the public link. Tell us what you see in it. The agents handle the long research pass.</p>
          <dl>
            <div><dt>Time</dt><dd>About 2 minutes</dd></div>
            <div><dt>Needed</dt><dd>One URL + your reason</dd></div>
            <div><dt>Next</dt><dd>Review before research</dd></div>
            <div><dt>Call</dt><dd>Public projects</dd></div>
          </dl>
        </header>
        <NominationForm initialUrl={initialUrl} />
      </main>
    </>
  );
}
