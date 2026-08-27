import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { loadPublishedScoutCard } from "@/features/scout-card/data";

import { CreatorUpdateDesk } from "./creator-update-desk";

export const dynamic = "force-dynamic";

export default async function ManageProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await loadPublishedScoutCard(slug);
  if (!card) notFound();
  return <><SiteHeader /><CreatorUpdateDesk projectId={card.projectId} slug={card.slug} title={card.title} /></>;
}
