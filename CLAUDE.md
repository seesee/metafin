# CLAUDE.md

Purpose

- Keep contributions focused, consistent, and high quality across the metafin codebase.
- Reinforce guardrails already set by the specification without re-stating deep details.
- Provide a clear workflow, response format, and definition of done for every change.

Project Anchors (do not violate)

- Scope v1: series/season/episode workflows first; movies are secondary.
- Jellyfin 10.10.7 is the canonical source. All reads/writes go through the backend using an admin API key. The browser must never call Jellyfin or see secrets.
- Providers: TVMaze and Wikidata by default; TMDb only if an API key is supplied. No scraping of sites that forbid it.
- Architecture: pnpm workspace, TypeScript strict everywhere, NestJS + Prisma + SQLite backend, SvelteKit + Tailwind + i18next frontend. No Redis in v1.
- Hosting: single Docker image, linux/amd64 and linux/arm64 builds, reverse proxy handles auth. BASE_PATH must be respected end-to-end.
- i18n and accessibility are first-class requirements in all UI code.

Golden Rules

- Stay in scope. If a request implies new scope or external services, propose a minimal in-scope alternative or ask for approval.
- Favour simplicity, determinism, and maintainability. No cleverness that harms clarity.
- Preserve backward compatibility with Jellyfin 10.10.7. If an API is uncertain, add capability checks and clear error messages.
- Never log secrets or leak API keys to the frontend. Treat environment-derived values as sensitive.
- Use British English for all text, comments, and copy.

How To Work A Task (template)

1. Clarify

- If a requirement is ambiguous, ask one focused question. Otherwise proceed.

2. Plan

- State a short plan: data model impact, API endpoints or UI components affected, and risks.

3. Implement

- Follow coding standards below. Keep diffs small, modular, and well-tested.

4. Test

- Unit tests for logic; integration/E2E where applicable. Use fixtures; no live external calls in tests.

5. Verify

- Run lint, typecheck, tests, and local manual checks for BASE_PATH, i18n, and dark/light themes if UI.

6. Document

- Update minimal docs: code comments, README snippet if relevant, OpenAPI if backend routes change.

7. Submit

- Use Conventional Commits. Include a crisp PR description and tick the Review Checklist below.

Preferred Response Style (when generating code or changes)

- Start with a 3–6 line summary of intent.
- Provide concise rationale for key decisions.
- Supply complete code patches or files with correct formatting; avoid pseudo-code for final outputs.
- End with a verification checklist specific to the change.

Coding Standards

- TypeScript strict: noImplicitAny, strictNullChecks, no floating any.
- Formatting: Prettier print width 80; ESLint clean.
- APIs: DTOs validated; errors mapped to structured codes; keep OpenAPI spec current.
- Frontend: Svelte + TypeScript; stores and actions typed; no direct window.fetch to Jellyfin; use the typed client to backend.
- Avoid unnecessary dependencies; prefer standard libs and small utilities.

Security & Privacy

- Secrets only on server; never embed in frontend bundles or logs.
- Redact tokens in logs; show requestId for correlation.
- Validate and sanitise all inputs; encode outputs; safe file and URL handling.
- Respect provider ToS; enforce rate limits and backoff on 429/5xx.

Internationalisation & Accessibility

- All user-visible text must use i18next keys. No hard-coded strings.
- Language-aware features (e.g., artwork language) respect user settings.
- Accessibility: keyboard navigable, ARIA labels, focus management, sufficient contrast, and visible focus rings.
- Dates/numbers via Intl and en-GB defaults.

API & Data Contracts

- Jellyfin client encapsulates all calls; add capability checks for endpoints that vary.
- SQLite is the only persistence; migrations must be additive and idempotent.
- BASE_PATH must be honoured in both frontend (PUBLIC_BASE_PATH) and backend (BASE_PATH).
- Provider modules must adhere to the provider interface and rate limiting.

Performance & Reliability

- Server-side pagination and indexed filtering for large libraries.
- Concurrency limits for Jellyfin and providers; retry with exponential backoff and jitter.
- Cache hot paths in-memory safely; persist provider caches in SQLite with TTLs.
- Avoid N+1 patterns; batch requests when practical.

Testing & QA

- Unit tests for core logic and adapters using fixtures.
- Integration tests for Jellyfin flows via dockerised test instance (no external internet dependency for CI).
- Frontend tests: component tests and Playwright E2E for critical flows.
- Target: high coverage on critical modules; meaningful assertions (not snapshots by default).

Docs & Developer Experience

- Keep README and OpenAPI accurate when changing public surfaces.
- Add inline comments for non-obvious logic and decisions.
- Maintain consistent scripts: dev, build, test, lint, typecheck, db:migrate.

Docker & CI

- Single production image with non-root user, healthcheck, and /data volume.
- Multi-arch buildx pipeline for linux/amd64 and linux/arm64/v8.
- CI must run lint, typecheck, tests, and build. Fail fast on quality gates.

Out-of-Scope Reminders (v1)

- No user auth inside metafin; rely on reverse proxy.
- No Redis, Prometheus, or external observability stacks.
- No scraping of IMDb or other prohibited sources.
- No moving/renaming media files.

PR Review Checklist (paste into every PR)

- [ ] Scope: Change stays within v1 goals and existing architecture.
- [ ] Security: No secrets in code, logs, or frontend; inputs validated; outputs encoded.
- [ ] i18n/a11y: All strings externalised; keyboard navigation preserved; ARIA and focus states verified.
- [ ] API: Backward compatible; DTOs validated; OpenAPI updated if routes changed.
- [ ] BASE_PATH: Verified routing and assets under custom subpath.
- [ ] Tests: Unit/integration/E2E updated; no live external calls; coverage for critical paths.
- [ ] Quality: ESLint/Prettier clean; TypeScript strict passes; small, readable diffs.
- [ ] Perf/Reliability: Pagination/indexing present; concurrency limits and retries where needed.
- [ ] Docs: Minimal docs updated (README/OpenAPI/comments); migration added if schema changed.
- [ ] Manual QA: Sanity-checked on local Jellyfin 10.10.7; verified key flows affected by this change.

When To Ask A Question

- Jellyfin endpoint behaviour unclear or version-specific.
- Provider ToS, rate limits, or ID mapping ambiguity.
- Changes that add new dependencies, modify security posture, or expand scope.
- Non-trivial UX trade-offs that affect accessibility or i18n.

Acceptance Bar (per change)

- Clear problem statement and small plan included.
- Code compiles, types check, tests pass locally and in CI.
- Behaviour verified against Jellyfin 10.10.7 where applicable.
- No regressions in BASE_PATH handling, i18n, or accessibility.
- User-facing text in British English and externalised.

Remember

- Prefer the simplest solution that fully meets requirements.
- Make it easy to revert or iterate: small PRs, obvious tests, and clear rationale.

# Development Environment Setup

## Current Implementation Status

✅ Backend: NestJS + Prisma + SQLite with provider system (TVMaze, Wikidata)
✅ Frontend: SvelteKit + Tailwind with comprehensive metadata editing UI
✅ Database: Initialized with migrations and connected
✅ Full-stack integration: Both servers working together

## Quick Start Commands

### Backend (Port 8080)

```bash
cd apps/backend
DATABASE_URL="file:./prisma/dev.db" JELLYFIN_URL=http://localhost:8096 JELLYFIN_API_KEY=test pnpm start
```

### Frontend (Port 3000)

```bash
cd apps/frontend
pnpm dev
```

### Database Management

```bash
cd apps/backend
DATABASE_URL="file:./prisma/dev.db" pnpm prisma migrate dev --name <migration-name>
DATABASE_URL="file:./prisma/dev.db" pnpm prisma studio  # Database UI
```

## API Endpoints Available

- `GET /api/hello` - Test endpoint
- `GET /api/health` - System health status
- `GET /api/providers/health` - Provider status
- `POST /api/providers/search` - Search across providers
- Full metadata and library management endpoints

## Current Capabilities

- Comprehensive metadata editing forms with all field types
- Provider integration with TVMaze and Wikidata
- Artwork management and upload functionality
- Library browsing with search and filtering
- Full health monitoring and status reporting
