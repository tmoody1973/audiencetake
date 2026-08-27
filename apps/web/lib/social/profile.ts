import { getAdminFirestore } from "@/lib/firebase/admin";

export type ScoutProfileItem = {
  id: string;
  projectId?: string;
  projectTitle?: string;
  projectSlug?: string;
  createdAt?: string;
  title?: string;
  body?: string;
  commitmentTypes?: string[];
};

export type ScoutProfile = {
  uid: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  demoLabel?: string;
  counts: { picks: number; following: number; takes: number };
  picks: ScoutProfileItem[];
  following: ScoutProfileItem[];
  takes: ScoutProfileItem[];
};

type Snap = { id: string; exists: boolean; data(): Record<string, unknown> | undefined };
const stringValue = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const dateValue = (value: unknown) => typeof value === "string" ? value : value && typeof (value as { toDate?: unknown }).toDate === "function" ? ((value as { toDate: () => Date }).toDate()).toISOString() : undefined;

function item(snapshot: Snap): ScoutProfileItem {
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    projectId: stringValue(data.projectId) || undefined,
    projectTitle: stringValue(data.projectTitle || data.title) || undefined,
    projectSlug: stringValue(data.projectSlug || data.slug) || undefined,
    createdAt: dateValue(data.createdAt || data.publishedAt),
    title: stringValue(data.title) || undefined,
    body: stringValue(data.body || data.text || data.content) || undefined,
  };
}

async function enrichProjects(database: ReturnType<typeof getAdminFirestore>, entries: ScoutProfileItem[]) {
  const ids = [...new Set(entries.map((entry) => entry.projectId).filter((id): id is string => Boolean(id)))];
  const projects = await Promise.all(ids.map(async (id) => [id, await database.collection("projects").doc(id).get()] as const));
  const lookup = new Map(projects.map(([id, snapshot]) => [id, snapshot.data() ?? {}]));
  return entries.map((entry) => {
    const project = entry.projectId ? lookup.get(entry.projectId) : undefined;
    if (!project) return entry;
    return { ...entry, projectTitle: stringValue(project.title, entry.projectTitle), projectSlug: stringValue(project.slug, entry.projectSlug) };
  });
}

export async function loadPublicScoutProfile(handle: string): Promise<ScoutProfile | null> {
  const normalized = handle.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(normalized)) return null;
  const database = getAdminFirestore();
  const handleSnap = await database.collection("handles").doc(normalized).get();
  if (!handleSnap.exists) return null;
  const uid = stringValue(handleSnap.data()?.uid);
  if (!uid) return null;
  const profileSnap = await database.collection("users").doc(uid).get();
  const profile = profileSnap.data();
  if (!profileSnap.exists || !profile || profile.visibility !== "public") return null;

  const [nominations, follows, commitments, takes] = await Promise.all([
    database.collection("nominations").where("nominatorUid", "==", uid).where("visibility", "==", "public").orderBy("createdAt", "desc").get(),
    database.collection("follows").where("uid", "==", uid).where("active", "==", true).orderBy("createdAt", "desc").get(),
    database.collection("commitments").where("uid", "==", uid).where("active", "==", true).orderBy("createdAt", "desc").get(),
    database.collection("takes").where("uid", "==", uid).where("status", "==", "published").orderBy("createdAt", "desc").get(),
  ]);
  const publicActivity = profile.publicActivity === true;
  const pickItems = await enrichProjects(database, nominations.docs.map(item));
  const grouped = new Map<string, ScoutProfileItem>();
  if (publicActivity) {
    for (const snapshot of [...follows.docs, ...commitments.docs]) {
      const next = item(snapshot);
      if (!next.projectId) continue;
      const existing = grouped.get(next.projectId);
      const type = stringValue(snapshot.data()?.type);
      grouped.set(next.projectId, {
        ...(existing ?? next),
        createdAt: [existing?.createdAt, next.createdAt].filter(Boolean).sort().at(-1),
        commitmentTypes: [...new Set([...(existing?.commitmentTypes ?? []), ...(type ? [type] : [])])],
      });
    }
  }
  const followingItems = await enrichProjects(database, [...grouped.values()].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")));
  const takeItems = await enrichProjects(database, takes.docs.map(item));
  return {
    uid,
    handle: normalized,
    displayName: stringValue(profile.displayName, normalized),
    bio: stringValue(profile.bio),
    ...(stringValue(profile.avatarUrl) ? { avatarUrl: stringValue(profile.avatarUrl) } : {}),
    ...(stringValue(profile.demoLabel) ? { demoLabel: stringValue(profile.demoLabel) } : {}),
    counts: { picks: pickItems.length, following: followingItems.length, takes: takeItems.length },
    picks: pickItems, following: followingItems, takes: takeItems,
  };
}
