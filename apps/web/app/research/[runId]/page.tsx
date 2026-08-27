import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteHeader } from "../../../components/site-header";
import { ResearchProgress } from "../../../features/research-progress/research-progress";

const SAFE_RUN_ID = /^[A-Za-z0-9_-]{1,128}$/;

export const metadata: Metadata = {
  title: "Live scouting run",
  description: "Follow six persisted research stages and inspect public-safe receipts as the Scout Card is built.",
};

export default async function ResearchRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!SAFE_RUN_ID.test(runId)) notFound();
  return <><SiteHeader /><ResearchProgress runId={runId} /></>;
}

