import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";

export const RESEARCH_STAGES = [
  { id: "reading-source", label: "Reading source", summary: "Inspecting the submitted public source." },
  { id: "mapping-story", label: "Mapping story", summary: "Separating premise, characters, world, and format signals." },
  { id: "parallel-search", label: "Parallel search", summary: "Searching the current public web with Parallel." },
  { id: "checking-evidence", label: "Checking evidence", summary: "Cross-checking claims and marking uncertainty." },
  { id: "three-pathways", label: "Three pathways", summary: "Shaping three bounded ways the project could grow." },
  { id: "publishing-scout-card", label: "Publishing card", summary: "Packaging cited findings into the public Scout Card." },
] as const;

export type RunStatus = "queued" | "running" | "complete" | "partial" | "failed";
export type StageState = "waiting" | "active" | "complete" | "incomplete" | "failed";

export type PublicResearchRun = {
  runId: string | null;
  projectId: string | null;
  attempt: number;
  researchVersion: number;
  status: RunStatus;
  currentStage: number;
  completedStages: number[];
  missingStages: number[];
  publicFailureMessage: string | null;
  projectSlug: string | null;
  cardUrl: string | null;
  retryEligible: boolean;
  fallbackUsed: boolean;
  fallbackLabel?: "Previously generated — live refresh unavailable.";
  updatedAt: string | null;
};

export type PublicResearchEvent = {
  id: string;
  sequence: number;
  stage: number;
  status: StageState;
  kind: string;
  title: string;
  summary: string;
  occurredAt: string | null;
  toolName: string | null;
  queryLabel: string | null;
};

export type ResearchSnapshot = {
  mode: "live" | "demo";
  run: PublicResearchRun;
  events: PublicResearchEvent[];
};

const statusValues = new Set<RunStatus>(["queued", "running", "complete", "partial", "failed"]);
const stageStateValues = new Set<StageState>(["waiting", "active", "complete", "incomplete", "failed"]);

function stageNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 6) return value;
  if (typeof value === "string") {
    const index = RESEARCH_STAGES.findIndex((stage) => stage.id === value);
    if (index >= 0) return index + 1;
  }
  return null;
}

function stageNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(stageNumber).filter((stage): stage is number => stage !== null))];
}

function publicString(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.length <= maxLength ? value : null;
}

function projectSlug(value: unknown): string | null {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : null;
}

function scoutCardUrl(value: unknown): string | null {
  return typeof value === "string" && /^\/projects\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const candidate = value as { toDate(): Date };
    return candidate.toDate().toISOString();
  }
  return null;
}

export function parsePublicRun(data: DocumentData): PublicResearchRun {
  const status = statusValues.has(data.status) ? (data.status as RunStatus) : "queued";
  const fallbackLabel =
    data.fallbackLabel === "Previously generated — live refresh unavailable."
      ? data.fallbackLabel
      : undefined;
  return {
    runId: publicString(data.runId, 128),
    projectId: publicString(data.projectId, 128),
    attempt: Number.isInteger(data.attempt) && data.attempt >= 1 ? data.attempt : 1,
    researchVersion: Number.isInteger(data.researchVersion) && data.researchVersion >= 1 ? data.researchVersion : 1,
    status,
    currentStage: stageNumber(data.currentStage) ?? 1,
    completedStages: stageNumbers(data.completedStages),
    missingStages: stageNumbers(data.missingStages),
    publicFailureMessage: publicString(data.publicFailureMessage, 500),
    projectSlug: projectSlug(data.projectSlug),
    cardUrl: scoutCardUrl(data.cardUrl),
    retryEligible: data.retryEligible === true,
    fallbackUsed: data.fallbackUsed === true,
    ...(fallbackLabel ? { fallbackLabel } : {}),
    updatedAt: isoDate(data.updatedAt),
  };
}

export function parsePublicEvent(id: string, data: DocumentData): PublicResearchEvent | null {
  if (data.publicVisibility !== "public" || !Number.isInteger(data.sequence) || !Number.isInteger(data.stage) || data.stage < 1 || data.stage > 6) return null;
  const title = publicString(data.publicTitle, 120);
  const summary = publicString(data.publicSummary, 500);
  if (!title || !summary) return null;
  return {
    id,
    sequence: data.sequence,
    stage: data.stage,
    status: stageStateValues.has(data.status) ? (data.status as StageState) : "waiting",
    kind: publicString(data.kind, 80) ?? "receipt",
    title,
    summary,
    occurredAt: isoDate(data.occurredAt),
    toolName: publicString(data.toolName, 80),
    queryLabel: publicString(data.queryLabel, 120),
  };
}

export function localJunichiroDemo(): ResearchSnapshot {
  return {
    mode: "demo",
    run: {
      runId: "demo-junichiro",
      projectId: "junichiro-jackson-demo",
      attempt: 1,
      researchVersion: 1,
      status: "running",
      currentStage: 3,
      completedStages: [1, 2],
      missingStages: [],
      publicFailureMessage: null,
      projectSlug: null,
      cardUrl: null,
      retryEligible: false,
      fallbackUsed: false,
      updatedAt: null,
    },
    events: [
      {
        id: "demo-source",
        sequence: 1,
        stage: 1,
        status: "complete",
        kind: "source_receipt",
        title: "Submitted source logged",
        summary: "Junichiro Jackson’s public YouTube link is the supplied source for this local interface demonstration.",
        occurredAt: null,
        toolName: "YouTube",
        queryLabel: "Submitted source",
      },
      {
        id: "demo-parallel",
        sequence: 2,
        stage: 3,
        status: "active",
        kind: "tool_receipt",
        title: "Live receipt pending",
        summary: "Configured runtime receipts will replace this demonstration row; no provider result or count is being claimed.",
        occurredAt: null,
        toolName: "Parallel",
        queryLabel: "Public-web research",
      },
    ],
  };
}

export function subscribeToPublicResearch(
  database: Firestore,
  runId: string,
  onValue: (snapshot: ResearchSnapshot | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  let run: PublicResearchRun | null = null;
  let events: PublicResearchEvent[] = [];
  const emit = () => onValue(run ? { mode: "live", run, events } : null);

  const unsubscribeRun = onSnapshot(
    doc(database, "publicResearchRuns", runId),
    (snapshot) => {
      run = snapshot.exists() ? parsePublicRun(snapshot.data()) : null;
      emit();
    },
    onError,
  );
  const publicEvents = query(
    collection(database, "events"),
    where("runId", "==", runId),
    where("publicVisibility", "==", "public"),
    orderBy("sequence", "asc"),
  );
  const unsubscribeEvents = onSnapshot(
    publicEvents,
    (snapshot) => {
      events = snapshot.docs
        .map((event) => parsePublicEvent(event.id, event.data()))
        .filter((event): event is PublicResearchEvent => event !== null);
      emit();
    },
    onError,
  );
  return () => {
    unsubscribeRun();
    unsubscribeEvents();
  };
}

export function stageState(run: PublicResearchRun, stage: number): StageState {
  if (run.missingStages.includes(stage)) return "incomplete";
  if (run.completedStages.includes(stage) || (run.status === "complete" && stage <= 6)) return "complete";
  if (run.status === "failed" && stage === run.currentStage) return "failed";
  if (run.status === "running" && stage === run.currentStage) return "active";
  return "waiting";
}
