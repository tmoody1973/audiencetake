import type { Metadata } from "next";
import "./globals.css";

const directionContract = `THESIS: A fan nomination becomes a public scouting object; refuse the generic centered AI hero and floating feature-card grid.
OWN-WORLD: Warm paper, near-black ink, acid yellow, electric blue, coral, evidence green; contact-sheet seams, program numbers, ticket edges, crop marks, hard rules and controlled offset shadows.
STORY: Understand that fans find projects first, begin a nomination, see agents scout truthfully, and recognize the Scout Card as the social object.
FIRST VIEWPORT: Masthead above a two-field composition: giant mission on the left, URL-first nomination ticket on the right; Junichiro contact strip anchors the fold.
FORM: Contact-sheet scouting wall, grounded candidate 3, seed 2ca41c25.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md`;

export const metadata: Metadata = {
  metadataBase: new URL("https://audiencetake.com"),
  title: {
    default: "Audience Take — Find what should be made next",
    template: "%s — Audience Take",
  },
  description:
    "Nominate overlooked screen projects and turn public evidence into a Scout Card the audience can champion.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <pre className="direction-contract" data-direction-contract hidden>
          {directionContract}
        </pre>
        {children}
      </body>
    </html>
  );
}
