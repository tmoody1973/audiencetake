import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { SiteHeader } from "../../../components/site-header";
import { loadPublicScoutProfile, type ScoutProfileItem } from "../../../lib/social/profile";
import styles from "./page.module.css";

type Props = { params: Promise<{ handle: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const profile = await loadPublicScoutProfile(handle);
  return profile ? { title: `${profile.displayName} (@${profile.handle})`, description: profile.bio || `See ${profile.displayName}'s Audience Take activity.` } : { title: "Scout not found", robots: { index: false } };
}

function Activity({ value, empty, takes = false }: { value: ScoutProfileItem[]; empty: string; takes?: boolean }) {
  if (!value.length) return <p className={styles.empty}>{empty}</p>;
  return <div className={styles.list}>{value.map((entry) => {
    const href = entry.projectSlug ? `/projects/${entry.projectSlug}` : undefined;
    const content = <><span className={styles.itemTitle}>{entry.projectTitle || entry.title || (takes ? "Published take" : "Activity")}</span>{entry.body && <span>{entry.body}</span>}<span className={styles.meta}>{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : "Audience Take"}</span></>;
    return href ? <Link className={styles.item} href={href} key={entry.id}>{content}</Link> : <div className={styles.item} key={entry.id}>{content}</div>;
  })}</div>;
}

export default async function ScoutProfilePage({ params }: Props) {
  const profile = await loadPublicScoutProfile((await params).handle);
  if (!profile) notFound();
  const initial = profile.displayName.slice(0, 1).toUpperCase();
  return <><SiteHeader /><main className={styles.page}><section className={styles.identity}>{profile.avatarUrl ? <img // eslint-disable-line @next/next/no-img-element
  className={styles.avatar} src={profile.avatarUrl} alt="" /> : <div className={`${styles.avatar} ${styles.avatarFallback}`} aria-hidden="true">{initial}</div>}<div><h1 className={styles.name}>{profile.displayName}</h1><p className={styles.handle}>@{profile.handle}</p>{profile.bio && <p className={styles.bio}>{profile.bio}</p>}{profile.demoLabel && <span className={styles.label}>{profile.demoLabel}</span>}</div></section><div className={styles.counts}><span><strong>{profile.counts.picks}</strong>My Picks</span><span><strong>{profile.counts.following}</strong>Following</span><span><strong>{profile.counts.takes}</strong>My Takes</span></div><section className={styles.section}><h2>My Picks</h2><Activity value={profile.picks} empty="No public nominations yet." /></section><section className={styles.section}><h2>Following</h2><Activity value={profile.following} empty="Following is private for this scout." /></section><section className={styles.section}><h2>My Takes</h2><Activity value={profile.takes} empty="No published takes yet." takes /></section></main></>;
}
