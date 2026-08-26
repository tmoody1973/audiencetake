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
5. Enable Google and Email/Password providers in Firebase Authentication for a real project. The local Auth emulator supports creating multiple disposable test accounts without production credentials.
6. Run `npm run emulators:start` for Auth, Firestore, and Storage, then run `npm run dev` in another terminal.
7. Set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` and `APP_CHECK_ENFORCEMENT_ENABLED=false` locally. Production command routes require App Check by default; use `NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG=true` only with the local/debug App Check flow.
8. Run `npm run emulators:seed-demo` to start a temporary Firestore emulator and load the three labeled demo profiles. To seed an already running emulator, set its `FIRESTORE_EMULATOR_HOST` and run `npm run seed:demo`.

Firebase Admin uses Application Default Credentials in deployed environments and emulator host variables locally. Production always enforces App Check, even if a copied local environment file says otherwise. Public profile fields live in `users`; custom claims and the unreadable `roleAssignments` collection hold admin and project-scoped creator authority. Do not add service-account JSON files. The demo seeder refuses to target a non-emulated project unless `ALLOW_DEMO_SEED=true` is deliberately set for an approved demo environment.

## Verification

```bash
npm run check
npm run test:python
npm run test:emulators
```

The deployed Gemini/Parallel smoke test is intentionally separate from deterministic local tests.

## Demo-data policy

Junichiro Jackson is the primary demonstration project and must remain labeled **Fan nomination — unclaimed by creator** unless a separately identified pre-approved creator state is being demonstrated. Seeded accounts and actions always display a demo label.

## Planning documents

The complete approved planning packet lives in `docs/hackathon-build/`. The build checklist is the implementation contract.

## License

An open-source license will be selected and added before public submission. Until then, all rights are reserved.
