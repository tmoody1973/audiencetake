import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { SiteHeader } from "../../../components/site-header";
import {
  JUNICHIO_LIVE_SLUG,
  JUNICHIO_SLUG,
  loadPublishedScoutCard,
} from "../../../features/scout-card/data";
import { ScoutCard } from "../../../features/scout-card/scout-card";

type ProjectPageProps = { params: Promise<{ slug: string }> };

const PROJECT_ROUTE_ALIASES: Readonly<Record<string, string>> = {
  // The preserved research card still treats the exact Junichiro identity as
  // unresolved. Keep its stored title/slug immutable while supporting the
  // memorable demo URL as a transparent redirect to the verified live route.
  [JUNICHIO_SLUG]: JUNICHIO_LIVE_SLUG,
};

export const dynamic = "force-dynamic";
const loadCardForRequest = cache(loadPublishedScoutCard);

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const aliasedSlug = PROJECT_ROUTE_ALIASES[slug];
  if (aliasedSlug) {
    return {
      title: "Junichiro Scout Card",
      description: "Continue to the verified live Scout Card route.",
      alternates: { canonical: `/projects/${aliasedSlug}` },
      robots: { index: false, follow: true },
    };
  }
  const card = await loadCardForRequest(slug);
  if (!card) return { title: "Scout Card not found", robots: { index: false, follow: false } };
  const title = `${card.title}${card.fallbackUsed ? " saved" : ""} Scout Card`;
  const description = card.fallbackUsed
    ? `${card.fallbackLabel} ${card.hook}`
    : `${card.hook} Read the cited ${card.completeness} Scout Card and three bounded pathway hypotheses.`;
  return {
    title,
    description,
    alternates: { canonical: `/projects/${card.slug}` },
    openGraph: { type: "article", title, description, url: `/projects/${card.slug}`, publishedTime: card.publishedAt },
    twitter: { card: "summary", title, description },
    ...(card.fallbackUsed ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const aliasedSlug = PROJECT_ROUTE_ALIASES[slug];
  if (aliasedSlug) permanentRedirect(`/projects/${aliasedSlug}`);
  const card = await loadCardForRequest(slug);
  if (!card) notFound();
  return <><SiteHeader /><ScoutCard card={card} /></>;
}
