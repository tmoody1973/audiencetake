# Audience Take

> The audience's take on what should be made next.

Audience Take is a social scouting platform where fans nominate overlooked screen projects, Google ADK agents research them with Gemini and Parallel, and a cited Scout Card activates audience commitments, creator claiming, and industry evaluation.

## Repository

- `apps/web` — Next.js public application and trusted command endpoints.
- `services/agents` — Python Google ADK research service for Cloud Run.
- `contracts` — canonical JSON Schemas and cross-runtime fixtures.
- `firebase` — Firestore/Storage rules, indexes, and demo seed data.
- `infra` — Cloud Run, Cloud Tasks, IAM, and deployment notes.
- `docs` — approved product, UX, architecture, and build documentation.
- `tests/e2e` — deployed judge-journey tests.

## Local setup

1. Copy `.env.example` to `.env.local` and add your own development values. Never commit it.
2. Install Java, Node 22+, Python 3.12, `uv`, and the Firebase CLI.
3. Run `npm install`.
4. Run `uv sync --project services/agents`.
5. Run `npm run dev` for the web app.
6. Run `firebase emulators:start` when working with Firebase-backed flows.

## Verification

```bash
npm run check
npm run test:python
```

The deployed Gemini/Parallel smoke test is intentionally separate from deterministic local tests.

## Demo-data policy

Junichiro Jackson is the primary demonstration project and must remain labeled **Fan nomination — unclaimed by creator** unless a separately identified pre-approved creator state is being demonstrated. Seeded accounts and actions always display a demo label.

## Planning documents

The complete approved planning packet lives in `docs/hackathon-build/`. The build checklist is the implementation contract.

## License

An open-source license will be selected and added before public submission. Until then, all rights are reserved.
