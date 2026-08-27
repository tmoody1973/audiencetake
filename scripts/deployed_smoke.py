"""Seed and inspect one isolated deployed Audience Take smoke run.

This helper never enqueues or invokes provider work. Cloud Tasks remains the
explicit, separately controlled execution boundary.
"""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime, timedelta
from typing import Any

from audience_take_agents.runtime.firestore_store import FirestoreRuntimeStore
from audience_take_agents.runtime.models import (
    ResearchTaskRequest,
    RunStatus,
    TaskDelivery,
)
from audience_take_agents.runtime.service import RuntimeContext
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter


def iso(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")
    if isinstance(value, dict):
        return {key: iso(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [iso(item) for item in value]
    return value


def client(project: str) -> firestore.Client:
    return firestore.Client(project=project)


def seed(args: argparse.Namespace) -> None:
    database = client(args.project)
    now = datetime.now(UTC)
    task_name = f"research-{args.run_id}-attempt-1"
    slug = "junichiro-jackson-live"
    card_url = f"/projects/{slug}"
    refs = {
        "project": database.collection("projects").document(args.project_id),
        "nomination": database.collection("nominations").document(args.nomination_id),
        "run": database.collection("researchRuns").document(args.run_id),
        "publicRun": database.collection("publicResearchRuns").document(args.run_id),
    }
    collisions = [label for label, ref in refs.items() if ref.get().exists]
    if collisions:
        raise RuntimeError(f"refusing to overwrite existing documents: {', '.join(collisions)}")

    batch = database.batch()
    batch.create(
        refs["project"],
        {
            "slug": slug,
            "title": "Project under research",
            "canonicalSourceUrl": args.source_url,
            "projectType": "unknown",
            "submissionType": "fan",
            "claimStatus": "unclaimed",
            "publicationStatus": "pending",
            "cardCompleteness": "pending",
            "latestRunId": args.run_id,
            "researchVersion": 1,
            "missingSections": [],
            "followerCount": 0,
            "takeCount": 0,
            "replyCount": 0,
            "commitmentCounts": {},
            "pathwayVoteCounts": {},
            "isSelected": False,
            "sourceAvailability": "available",
            "moderationState": "clear",
            "createdAt": now,
            "updatedAt": now,
        },
    )
    batch.create(
        refs["nomination"],
        {
            "projectId": args.project_id,
            "nominatorUid": "deployed-smoke-operator",
            "submissionType": "fan",
            "submittedUrl": args.source_url,
            "canonicalUrl": args.source_url,
            "whyItShouldGrow": (
                "Its near-future Brooklyn, hip-hop identity, and supernatural horror "
                "already suggest a distinctive animated world worth scouting."
            ),
            "suggestedFormat": (
                "Premium adult animated series, independent animated feature, or "
                "creator-direct serialized animation and publishing franchise."
            ),
            "audienceFit": (
                "Adult animation, speculative horror, independent comics, and "
                "hip-hop storytelling audiences."
            ),
            "supportingUrls": [],
            "status": "accepted",
            "visibility": "public",
            "createdAt": now,
            "updatedAt": now,
        },
    )
    batch.create(
        refs["run"],
        {
            "projectId": args.project_id,
            "nominationId": args.nomination_id,
            "requestedByUid": "deployed-smoke-operator",
            "status": "queued",
            "currentStage": 1,
            "completedStages": [],
            "missingStages": [],
            "lastEventSequence": 0,
            "attemptCount": 1,
            "researchVersion": 1,
            "taskName": task_name,
            "dispatch": {"state": "pending", "attempt": 1},
            "parallelRequestCount": 0,
            "sourceCount": 0,
            "fallbackUsed": False,
            "createdAt": now,
            "updatedAt": now,
        },
    )
    batch.create(
        refs["publicRun"],
        {
            "runId": args.run_id,
            "projectId": args.project_id,
            "attempt": 1,
            "researchVersion": 1,
            "status": "queued",
            "currentStage": 1,
            "completedStages": [],
            "missingStages": [],
            "publicFailureMessage": None,
            "projectSlug": slug,
            "cardUrl": card_url,
            "retryEligible": False,
            "fallbackUsed": False,
            "updatedAt": now,
        },
    )
    batch.commit()
    print(
        json.dumps(
            {
                "runId": args.run_id,
                "projectId": args.project_id,
                "nominationId": args.nomination_id,
                "taskName": task_name,
                "sourceUrl": args.source_url,
            },
            indent=2,
        )
    )


def matching(database: firestore.Client, collection: str, field: str, value: str) -> list[dict[str, Any]]:
    query = database.collection(collection).where(filter=FieldFilter(field, "==", value))
    return [{"documentId": snapshot.id, **(snapshot.to_dict() or {})} for snapshot in query.stream()]


def inspect(args: argparse.Namespace) -> None:
    database = client(args.project)
    run_ref = database.collection("researchRuns").document(args.run_id)
    run_snapshot = run_ref.get()
    run = run_snapshot.to_dict() or {}
    project_id = str(run.get("projectId", ""))
    stage_outputs = [
        {"documentId": snapshot.id, **(snapshot.to_dict() or {})}
        for snapshot in run_ref.collection("stageOutputs").stream()
    ]
    events = matching(database, "events", "runId", args.run_id)
    events.sort(key=lambda event: int(event.get("sequence", 0)))
    publications = matching(database, "cardPublications", "runId", args.run_id)
    sources = matching(database, "sources", "runId", args.run_id)
    pathways = matching(database, "pathways", "runId", args.run_id)
    cards = matching(database, "scoutCards", "runId", args.run_id)
    citation_urls = sorted(
        {
            str(source.get("canonicalUrl") or source.get("url"))
            for source in sources
            if source.get("canonicalUrl") or source.get("url")
        }
    )
    result = {
        "runId": args.run_id,
        "run": run,
        "publicRun": (
            database.collection("publicResearchRuns").document(args.run_id).get().to_dict()
        ),
        "project": (
            database.collection("projects").document(project_id).get().to_dict()
            if project_id
            else None
        ),
        "stageOutputs": [
            {
                "documentId": output["documentId"],
                "stage": output.get("stage"),
                "completedAt": output.get("completedAt"),
            }
            for output in stage_outputs
        ],
        "events": [
            {
                key: event.get(key)
                for key in (
                    "documentId",
                    "sequence",
                    "stage",
                    "status",
                    "kind",
                    "publicTitle",
                    "publicSummary",
                    "toolName",
                    "queryLabel",
                    "resultCount",
                    "sourceIds",
                    "occurredAt",
                )
                if event.get(key) is not None
            }
            for event in events
        ],
        "publication": publications,
        "sourceCountPersisted": len(sources),
        "pathwayCountPersisted": len(pathways),
        "cardCountPersisted": len(cards),
        "citationUrls": citation_urls,
    }
    print(json.dumps(iso(result), indent=2, sort_keys=True))


def retry_blocker(
    run: dict[str, Any],
    stage_outputs: list[dict[str, Any]],
    *,
    allow_provider_proof: bool = False,
    allow_failed_publication: bool = False,
    public_run: dict[str, Any] | None = None,
) -> str | None:
    """Explain why a preserved smoke run cannot safely advance an attempt."""
    if run.get("status") != "queued":
        if (
            not allow_failed_publication
            or run.get("status") != "failed"
            or public_run is None
            or public_run.get("status") != "failed"
            or public_run.get("retryEligible") is not True
        ):
            return "run is neither queued nor a retry-eligible failed publication"
        if public_run.get("completedStages") != run.get("completedStages"):
            return "public and private completed stages do not match"
        if public_run.get("currentStage") != run.get("currentStage"):
            return "public and private current stages do not match"
        if public_run.get("researchVersion") != run.get("researchVersion"):
            return "public and private research versions do not match"
    request_count = int(run.get("parallelRequestCount", 0))
    source_count = int(run.get("sourceCount", 0))
    if allow_provider_proof:
        if request_count < 1 or source_count < 1:
            return "post-provider continuation requires durable provider proof"
    else:
        if request_count != 0:
            return "Parallel request proof already exists"
        if source_count != 0:
            return "persisted provider sources already exist"

    completed_stages = sorted({int(stage) for stage in run.get("completedStages", [])})
    output_stages = sorted({int(output.get("stage", 0)) for output in stage_outputs})
    if completed_stages != output_stages:
        return "completed stages do not match durable stage outputs"
    if completed_stages != list(range(1, len(completed_stages) + 1)):
        return "durable stages are not contiguous from stage 1"
    latest_allowed_stage = 5 if allow_provider_proof else 2
    if any(stage > latest_allowed_stage for stage in completed_stages):
        return f"stage {latest_allowed_stage + 1} or later already has durable output"
    if allow_provider_proof and 3 not in completed_stages:
        return "post-provider continuation requires durable stage 3"
    if int(run.get("currentStage", 1)) != len(completed_stages) + 1:
        return "current stage does not follow the durable stage outputs"
    research_version = int(run.get("researchVersion", 0))
    if any(
        int(output.get("researchVersion", 0)) != research_version
        for output in stage_outputs
    ):
        return "durable stage output belongs to another research version"
    return None


def publication_reconciliation_blocker(
    run: dict[str, Any],
    public_run: dict[str, Any],
    project: dict[str, Any],
    publication: dict[str, Any],
    *,
    card_exists: bool,
    sources_exist: bool,
    pathways_exist: bool,
    terminal_event_exists: bool,
) -> str | None:
    """Refuse reconciliation unless publication succeeded before finalization."""
    attempt = int(run.get("attemptCount", 0))
    research_version = int(run.get("researchVersion", 0))
    if run.get("status") != "queued" or run.get("leaseOwner") is not None:
        return "private run is not safely queued without an owner"
    if run.get("currentStage") != 6 or run.get("completedStages") != [1, 2, 3, 4, 5]:
        return "private run is not awaiting only stage 6 finalization"
    if int(run.get("lastEventSequence", 0)) < 6:
        return "private run has no prior terminal receipt to advance"
    if public_run.get("status") != "queued" or int(public_run.get("attempt", 0)) != attempt:
        return "public run does not match the queued attempt"
    if (
        public_run.get("currentStage") != 6
        or public_run.get("completedStages") != [1, 2, 3, 4, 5]
        or int(public_run.get("researchVersion", 0)) != research_version
    ):
        return "public run is not awaiting only stage 6 finalization"
    expected_publication_id = (
        f"publication-{run.get('runId') or publication.get('runId')}"
        f"-v{research_version}-a{attempt}"
    )
    if (
        publication.get("publicationId") != expected_publication_id
        or publication.get("outcome") != "complete"
        or publication.get("usefulEvidence") is not True
        or publication.get("missingSections") != []
        or int(publication.get("attempt", 0)) != attempt
        or int(publication.get("researchVersion", 0)) != research_version
    ):
        return "complete attempt-scoped publication decision is unavailable"
    card_version_id = publication.get("cardVersionId")
    if not isinstance(card_version_id, str) or not card_version_id or not card_exists:
        return "published Scout Card is unavailable"
    if len(publication.get("sourceIds", [])) != 10 or not sources_exist:
        return "the ten published sources are incomplete"
    if len(publication.get("pathwayIds", [])) != 3 or not pathways_exist:
        return "the three published pathways are incomplete"
    if (
        project.get("publicationStatus") != "published"
        or project.get("cardCompleteness") != "complete"
        or int(project.get("publishedResearchVersion", 0)) != research_version
        or project.get("latestCardVersionId") != card_version_id
    ):
        return "project publication pointer does not match the decision"
    if terminal_event_exists:
        return "attempt terminal receipt already exists"
    return None


def reconcile_publication(args: argparse.Namespace) -> None:
    """Finalize runtime projections after a verified atomic publication commit."""
    database = client(args.project)
    run_ref = database.collection("researchRuns").document(args.run_id)
    public_ref = database.collection("publicResearchRuns").document(args.run_id)
    run = run_ref.get().to_dict() or {}
    public_run = public_ref.get().to_dict() or {}
    project_id = str(run.get("projectId", ""))
    attempt = int(run.get("attemptCount", 0))
    research_version = int(run.get("researchVersion", 0))
    publication_id = f"publication-{args.run_id}-v{research_version}-a{attempt}"
    publication = (
        database.collection("cardPublications").document(publication_id).get().to_dict()
        or {}
    )
    project = database.collection("projects").document(project_id).get().to_dict() or {}
    card_version_id = str(publication.get("cardVersionId", ""))
    source_ids = [str(value) for value in publication.get("sourceIds", [])]
    pathway_ids = [str(value) for value in publication.get("pathwayIds", [])]
    artifact_prefix = f"{project_id}_v{research_version}_"
    next_sequence = int(run.get("lastEventSequence", 0)) + 1
    event_id = f"{args.run_id}_{attempt:03d}_{next_sequence:04d}"
    blocker = publication_reconciliation_blocker(
        {"runId": args.run_id, **run},
        public_run,
        project,
        publication,
        card_exists=bool(
            card_version_id
            and database.collection("scoutCards").document(card_version_id).get().exists
        ),
        sources_exist=all(
            database.collection("sources").document(f"{artifact_prefix}{source_id}").get().exists
            for source_id in source_ids
        ),
        pathways_exist=all(
            database.collection("pathways")
            .document(f"{artifact_prefix}{pathway_id}")
            .get()
            .exists
            for pathway_id in pathway_ids
        ),
        terminal_event_exists=database.collection("events").document(event_id).get().exists,
    )
    if blocker is not None:
        raise RuntimeError(f"refusing to reconcile publication: {blocker}")

    task = ResearchTaskRequest(
        runId=args.run_id,
        projectId=project_id,
        attempt=attempt,
        researchVersion=research_version,
        taskName=str(run["taskName"]),
    )
    store = FirestoreRuntimeStore(database)
    worker_id = "deployed-smoke-publication-reconciler"
    now = datetime.now(UTC)
    lease = store.acquire_lease(task, worker_id, now, timedelta(minutes=5))
    if not lease.should_execute:
        raise RuntimeError(f"refusing to reconcile publication: lease is {lease.disposition}")
    context = RuntimeContext(
        task=task,
        delivery=TaskDelivery(
            full_task_name=(
                f"projects/{args.project}/locations/us-central1/queues/"
                f"audience-take-research/tasks/{task.task_name}"
            ),
            queue_name=(
                f"projects/{args.project}/locations/us-central1/queues/"
                "audience-take-research"
            ),
            retry_count=0,
        ),
        worker_id=worker_id,
        store=store,
        clock=lambda: datetime.now(UTC),
        lease_duration=timedelta(minutes=5),
    )
    try:
        context.finish(
            sequence=context.next_event_sequence(),
            status=RunStatus.COMPLETE,
            title="Scout Card published",
            summary=str(publication["publicMessage"]),
        )
    except Exception:
        store.release_for_retry(task, worker_id, datetime.now(UTC))
        raise
    print(
        json.dumps(
            {
                "runId": args.run_id,
                "attempt": attempt,
                "publicationId": publication_id,
                "terminalEventId": event_id,
                "status": "complete",
            }
        )
    )


def align_card_route(args: argparse.Namespace) -> None:
    """Align mutable route pointers to an already-published immutable card slug."""
    database = client(args.project)
    run_ref = database.collection("researchRuns").document(args.run_id)
    public_ref = database.collection("publicResearchRuns").document(args.run_id)
    run = run_ref.get().to_dict() or {}
    public_run = public_ref.get().to_dict() or {}
    project_id = str(run.get("projectId", ""))
    project_ref = database.collection("projects").document(project_id)
    project = project_ref.get().to_dict() or {}
    card_version_id = str(project.get("latestCardVersionId", ""))
    card_ref = database.collection("scoutCards").document(card_version_id)
    card = card_ref.get().to_dict() or {}
    card_slug = str(card.get("slug", ""))
    if (
        run.get("status") != "complete"
        or public_run.get("status") != "complete"
        or project.get("publicationStatus") != "published"
        or project.get("cardCompleteness") != "complete"
        or card.get("visibility") != "public"
        or card.get("runId") != args.run_id
        or card.get("projectId") != project_id
        or card.get("cardVersionId") != card_version_id
        or not card_slug
    ):
        raise RuntimeError("refusing to align card route: complete publication is unavailable")
    if project.get("slug") == card_slug and public_run.get("projectSlug") == card_slug:
        print(json.dumps({"runId": args.run_id, "slug": card_slug, "changed": False}))
        return
    collisions = (
        database.collection("projects")
        .where(filter=FieldFilter("slug", "==", card_slug))
        .limit(2)
        .get()
    )
    if any(snapshot.id != project_id for snapshot in collisions):
        raise RuntimeError("refusing to align card route: published card slug is already in use")

    now = datetime.now(UTC)

    @firestore.transactional
    def operation(transaction: Any) -> None:
        current_project = project_ref.get(transaction=transaction).to_dict() or {}
        current_public = public_ref.get(transaction=transaction).to_dict() or {}
        current_card = card_ref.get(transaction=transaction).to_dict() or {}
        if (
            current_project.get("latestCardVersionId") != card_version_id
            or current_project.get("publicationStatus") != "published"
            or current_public.get("status") != "complete"
            or current_card.get("slug") != card_slug
        ):
            raise RuntimeError("card route inputs changed during reconciliation")
        transaction.update(
            project_ref,
            {
                "slug": card_slug,
                "title": current_card["title"],
                "projectType": current_card["projectType"],
                "claimStatus": current_card["claimStatus"],
                "updatedAt": now,
            },
        )
        transaction.update(
            public_ref,
            {
                "projectSlug": card_slug,
                "cardUrl": f"/projects/{card_slug}",
                "updatedAt": now,
            },
        )

    operation(database.transaction())
    print(json.dumps({"runId": args.run_id, "slug": card_slug, "changed": True}))


def prepare_retry(args: argparse.Namespace) -> None:
    """Advance a queued run while preserving safe pre-provider stage outputs."""
    database = client(args.project)
    run_ref = database.collection("researchRuns").document(args.run_id)
    public_ref = database.collection("publicResearchRuns").document(args.run_id)
    run_snapshot = run_ref.get()
    public_snapshot = public_ref.get()
    if not run_snapshot.exists or not public_snapshot.exists:
        raise RuntimeError("smoke run projections are unavailable")
    run = run_snapshot.to_dict() or {}
    public_run = public_snapshot.to_dict() or {}
    stage_outputs = [
        snapshot.to_dict() or {}
        for snapshot in run_ref.collection("stageOutputs").stream()
    ]
    blocker = retry_blocker(
        run,
        stage_outputs,
        allow_provider_proof=bool(getattr(args, "allow_provider_proof", False)),
        allow_failed_publication=bool(
            getattr(args, "allow_failed_publication", False)
        ),
        public_run=public_run,
    )
    if blocker is not None:
        raise RuntimeError(f"refusing to retry preserved run: {blocker}")
    previous_attempt = int(run.get("attemptCount", 0))
    next_attempt = previous_attempt + 1
    task_name = f"research-{args.run_id}-attempt-{next_attempt}"
    now = datetime.now(UTC)
    batch = database.batch()
    batch.update(
        run_ref,
        {
            "attemptCount": next_attempt,
            "taskName": task_name,
            "status": "queued",
            "leaseOwner": None,
            "leaseExpiresAt": None,
            "dispatch": {
                "state": "pending",
                "attempt": next_attempt,
                "priorDeliveryAttempts": args.prior_deliveries,
                "priorFailureCode": args.prior_failure_code,
            },
            "updatedAt": now,
        },
    )
    batch.update(
        public_ref,
        {
            "attempt": next_attempt,
            "status": "queued",
            "publicFailureMessage": None,
            "retryEligible": False,
            "updatedAt": now,
        },
    )
    batch.commit()
    print(json.dumps({"runId": args.run_id, "attempt": next_attempt, "taskName": task_name}))


def add_supporting_url(args: argparse.Namespace) -> None:
    database = client(args.project)
    if not args.url.startswith("https://"):
        raise RuntimeError("supporting URL must use HTTPS")
    run = database.collection("researchRuns").document(args.run_id).get().to_dict() or {}
    nomination_id = run.get("nominationId")
    if not isinstance(nomination_id, str) or not nomination_id:
        raise RuntimeError("smoke run nomination is unavailable")
    nomination_ref = database.collection("nominations").document(nomination_id)
    nomination = nomination_ref.get().to_dict() or {}
    supporting_urls = [str(url) for url in nomination.get("supportingUrls", [])]
    if args.url not in supporting_urls:
        supporting_urls.append(args.url)
        nomination_ref.update(
            {
                "supportingUrls": supporting_urls,
                "updatedAt": datetime.now(UTC),
            }
        )
    print(json.dumps({"runId": args.run_id, "supportingUrls": supporting_urls}, indent=2))


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser()
    root.add_argument("--project", default="test-app-mkark4")
    subparsers = root.add_subparsers(dest="command", required=True)
    seed_parser = subparsers.add_parser("seed")
    seed_parser.add_argument("--run-id", required=True)
    seed_parser.add_argument("--project-id", required=True)
    seed_parser.add_argument("--nomination-id", required=True)
    seed_parser.add_argument("--source-url", required=True)
    seed_parser.set_defaults(func=seed)
    inspect_parser = subparsers.add_parser("inspect")
    inspect_parser.add_argument("--run-id", required=True)
    inspect_parser.set_defaults(func=inspect)
    retry_parser = subparsers.add_parser("prepare-retry")
    retry_parser.add_argument("--run-id", required=True)
    retry_parser.add_argument("--prior-deliveries", required=True, type=int)
    retry_parser.add_argument("--prior-failure-code", required=True)
    retry_parser.set_defaults(
        func=prepare_retry,
        allow_provider_proof=False,
        allow_failed_publication=False,
    )
    continuation_parser = subparsers.add_parser("prepare-continuation")
    continuation_parser.add_argument("--run-id", required=True)
    continuation_parser.add_argument("--prior-deliveries", required=True, type=int)
    continuation_parser.add_argument("--prior-failure-code", required=True)
    continuation_parser.set_defaults(
        func=prepare_retry,
        allow_provider_proof=True,
        allow_failed_publication=True,
    )
    supporting_parser = subparsers.add_parser("add-supporting-url")
    supporting_parser.add_argument("--run-id", required=True)
    supporting_parser.add_argument("--url", required=True)
    supporting_parser.set_defaults(func=add_supporting_url)
    reconcile_parser = subparsers.add_parser("reconcile-publication")
    reconcile_parser.add_argument("--run-id", required=True)
    reconcile_parser.set_defaults(func=reconcile_publication)
    align_parser = subparsers.add_parser("align-card-route")
    align_parser.add_argument("--run-id", required=True)
    align_parser.set_defaults(func=align_card_route)
    return root


if __name__ == "__main__":
    arguments = parser().parse_args()
    arguments.func(arguments)
