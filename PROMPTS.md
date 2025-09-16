Title
metafin – Implementation TODO Prompts for Claude

Instructions
Each item below is a self-contained prompt. Copy one prompt at a time into Claude and iterate until complete. Keep PRs small and focused. Follow British English, TypeScript strict mode, and ensure all code is formatted with Prettier and passes ESLint.

Bootstrap And Tooling Prompts

Prompt 1: Repository Scaffolding

- Create a pnpm workspace repository for github.com/seesee/metafin with this structure:
  - apps/backend (NestJS)
  - apps/frontend (SvelteKit)
  - packages/shared (shared types and utilities)
  - .github/workflows for CI
  - .vscode with recommended extensions/settings
- Add root configs: .editorconfig, .gitignore, .gitattributes, LICENSE (MIT), README with quick start, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY.
- Configure pnpm with a lockfile and workspace file. Set engines to Node 20+.
- Acceptance: pnpm install at root succeeds; both apps compile with a placeholder “Hello” endpoint/page.

Prompt 2: Code Quality And Conventions

- Add ESLint and Prettier configs at root with TypeScript support and Svelte plugin for frontend; enforce print width 80.
- Enable strict TypeScript across all packages (noImplicitAny, strictNullChecks).
- Add Husky and lint-staged to run lint and format on commit.
- Add commitlint with Conventional Commits.
- Acceptance: running pnpm lint and pnpm format succeeds; pre-commit hook blocks broken code.

Prompt 3: Shared Package Setup

- Create packages/shared with:
  - Types for core domain: JellyfinItem, ItemType, ProviderIdMap, ArtworkType, CollectionRule, JobStatus, Diff structures.
  - Utility functions: title normalisation, safe fetch with timeout and retry, LRU cache, rate limiter token bucket.
  - Error classes: AppError with codes (VALIDATION_ERROR, PROVIDER_ERROR, JELLYFIN_ERROR, NOT_FOUND, CONFLICT).
- Export types and utilities for both apps.
- Acceptance: shared package builds and types are consumed by backend and frontend.

Backend Core Prompts

Prompt 4: NestJS App Skeleton

- Scaffold apps/backend with NestJS (standalone HTTP server).
- Modules: AppModule, ConfigModule, LoggerModule, HealthModule.
- Use class-validator for DTO validation; zod optional for internal schemas.
- Global pipes for validation, global exception filter mapping AppError to HTTP.
- Add /api/health returning version, uptime, build info.
- Acceptance: pnpm dev starts backend; curl /api/health returns JSON with 200.

Prompt 5: Configuration And Environment

- Implement strongly typed config service:
  - APP_PORT (default 8080)
  - BASE_PATH (default /)
  - JELLYFIN_URL, JELLYFIN_API_KEY (required at runtime or set via setup endpoint)
  - TMDB_API_KEY (optional)
  - DATABASE_URL (default file:/data/app.db)
  - TRUST_PROXY (default true)
  - DEFAULT_LOCALE (default en-GB)
- Add schema validation and runtime reload for setup changes.
- Respect BASE_PATH for all routes.
- Acceptance: invalid env fails fast with readable errors; BASE_PATH is honoured.

Prompt 6: SQLite And Prisma

- Add Prisma with a SQLite datasource at DATABASE_URL.
- Create initial schema with tables: settings, libraries, items, provider_ids, artwork_candidates, collections, collection_items, jobs, operation_logs.
- Generate Prisma Client, create a DatabaseService with health checks, migrations runner, and graceful shutdown.
- Acceptance: pnpm prisma migrate dev works; backend starts and ensures schema is current.

Prompt 7: Logger And Request Context

- Add structured logging (pino or nest-winston) with requestId and jobId correlation.
- Middleware to assign requestId per request; include in responses and logs.
- Redact secrets (API keys) in logs.
- Acceptance: logs contain requestId; no secrets appear in logs.

Jellyfin Integration Prompts

Prompt 8: Jellyfin HTTP Client (10.10.7)

- Implement a typed Jellyfin client:
  - Configurable base URL and X-Emby-Token header (admin API key).
  - Methods: list libraries, get items, get item by id, list children, update item metadata, set external IDs, upload images by type, create collection, add items to collection, refresh item, refresh library.
- Handle errors and map to AppError with status code and message.
- Acceptance: client works against a locally running Jellyfin 10.10.7 (use docker in tests).

Prompt 9: Jellyfin Cache And Sync Service

- Implement LibrarySyncService:
  - Full sync: enumerate libraries for series and movies; hydrate items table with hierarchy (series → seasons → episodes).
  - Incremental sync: update changed items using item modified timestamps or by polling specific endpoints.
  - Manual resync per library and per item subtree.
- Store path-derived heuristics (pathHash, runtimeMins, suspectedMisclassification boolean).
- Acceptance: after sync, items table mirrors Jellyfin with correct parent-child links.

Prompt 10: Jellyfin Write Operations

- Implement functions to:
  - Update provider IDs on items.
  - Update metadata fields (title, overview, airDate, seasonNumber, episodeNumber, genres, tags).
  - Upload artwork (Primary, Backdrop, Thumb).
  - Manage collections (create, add/remove items).
  - Trigger metadata refresh.
- Ensure idempotency and retries with exponential backoff.
- Acceptance: updates reflect in Jellyfin UI; retries on transient errors.

Provider Framework Prompts

Prompt 11: Provider Abstraction

- Define a Provider interface with capability flags and methods:
  - search, getSeries, getSeason, getEpisode, getArtwork, validateId, mapToCommonModel.
- Create a ProviderRegistry to register providers and resolve by name.
- Add per-provider rate limits and error wrapping with provenance tracking.
- Acceptance: registry lists providers and enforces capability checks.

Prompt 12: TVMaze Provider

- Implement TVMaze adapter:
  - Search by show name and optional year/country.
  - Fetch show details and episode guide by season/episode numbers and air dates.
  - Provide limited artwork if available.
- Cache responses in SQLite with TTL; respect rate limits.
- Acceptance: searching “Doctor Who” returns ranked candidates; episodes map correctly.

Prompt 13: Wikidata Provider

- Implement Wikidata adapter:
  - Search via wbsearchentities and optional SPARQL for series/season/episode relations.
  - Provide multilingual labels and alternative titles; basic artwork when available.
- Cache results and throttle queries.
- Acceptance: a known series returns entity ID and labels in multiple languages.

Prompt 14: TMDb Provider (Optional)

- Implement TMDb adapter with API key gating:
  - Search TV series; fetch posters and backdrops prioritising configured language.
  - Validate IDs; map to common model.
- If no API key, provider stays disabled but loadable.
- Acceptance: with key set, artwork candidates include TMDb images with dimensions and language.

Diff And Bulk Operations Prompts

Prompt 15: Diff Engine

- Implement a diff engine to compare current Jellyfin item metadata vs proposed changes:
  - Compute field-level changes with before/after values and conflict flags.
  - Support provider IDs, titles, overviews, air dates, numbers, genres, tags, artwork assignments, collection membership.
- Acceptance: returns deterministic diffs; empty diff for no-op.

Prompt 16: Bulk Operations Model And API

- Create DTOs and endpoints:
  - POST /api/operations/preview: accepts an operation spec (scope and changes), returns per-item diffs and API call counts.
  - POST /api/operations/execute: accepts a preview token, executes in batches with concurrency limits and retries, returns jobId.
  - GET /api/jobs/:id: status and per-item results.
- Persist jobs and logs in SQLite.
- Acceptance: end-to-end preview and execution works; job status updates in real time.

Prompt 17: Bulk Rematch

- Endpoint POST /api/match/bulk-assign:
  - Accept a target provider series match and a list of Jellyfin items or a filter.
  - Map seasons/episodes using number or air date rules.
  - Provide a preview before applying provider IDs.
- Acceptance: many episodes rematched reliably to a single series with a clear preview.

Artwork Prompts

Prompt 18: Artwork Aggregation

- Implement GET /api/items/:id/artwork:
  - Aggregate artwork candidates from TMDb (if enabled), TVMaze, Wikidata, and existing Jellyfin images.
  - Return type, url, width, height, language, source, rating/confidence.
- Cache candidates per item with TTL and manual refresh.
- Acceptance: UI receives a list of candidates sorted by quality and language.

Prompt 19: Artwork Apply

- Implement POST /api/items/:id/artwork:
  - Accept a selection for each image type; server downloads and streams upload to Jellyfin.
  - Validate formats and sizes; ensure original quality upload.
- Acceptance: selected poster/backdrop appears in Jellyfin immediately.

Collections Prompts

Prompt 20: Manual Collections

- Implement endpoints to list, create, rename, delete manual collections; add/remove items.
- Sync Jellyfin collection state into local cache.
- Acceptance: creating a collection and adding items is reflected in Jellyfin UI.

Prompt 21: Smart Collections (Rules-Based)

- Define a rule JSON schema (e.g., predicates over provider IDs, title pattern, library, dates, flags).
- Implement server-side evaluator that resolves rules to a set of item IDs.
- Provide endpoints to create/update smart collections and to materialise them into Jellyfin.
- Acceptance: building a smart collection yields expected members; rebuild on demand works.

Misclassification Detection Prompts

Prompt 22: Heuristics And Queue

- Implement a scoring function to flag “looks like movies”:
  - Path patterns like SxxExx.
  - Title similarity to known series.
  - Runtime 20–60 minutes.
  - Groupings in same folder.
- Store suspectedMisclassification with a score and reasons.
- Provide a review queue endpoint with suggested actions.
- Acceptance: list shows realistic suspects with evidence.

Prompt 23: Resolution Actions

- Implement API actions:
  - Add suspected items to a holding collection.
  - Initiate rematch flow to link to a series and assign season/episode numbers.
  - If conversion to series is not supported by API, guide with actionable steps and create collections for tracking.
- Acceptance: bulk actions operate with preview and clear outcomes.

Frontend Core Prompts

Prompt 24: SvelteKit App Skeleton

- Scaffold apps/frontend with SvelteKit + TypeScript + Tailwind CSS.
- Configure base path support from env (PUBLIC_BASE_PATH) and align with backend BASE_PATH for deployments under subpaths.
- Create a simple API client wrapper respecting the base path and propagating requestId headers.
- Acceptance: dev server runs; health status shown on home page.

Prompt 25: i18n Setup

- Integrate i18next with an en-GB default locale and runtime language switcher.
- Put all strings through translation keys; add missing-key console warnings in dev.
- Date/time formatting via Intl using locale.
- Acceptance: language can be switched at runtime; strings resolve correctly.

Prompt 26: Global Navigation And Layout

- Implement layout with navigation: Dashboard, Library, Search & Match, Bulk Ops, Collections, Jobs, Settings.
- Add breadcrumbs and responsive design; light/dark and high-contrast themes.
- Acceptance: navigation works; keyboard accessible.

Prompt 27: Dashboard

- Show cards for: missing provider IDs, no artwork, suspected misclassifications, recent jobs.
- Provide quick actions: start sync, open review queue, rebuild collections.
- Acceptance: cards query backend and update live.

Prompt 28: Library Browser With Filters

- Implement a virtualised grid/list with server-side pagination.
- Filters: library, type, missing IDs per provider, has/no artwork, year range, runtime, date added, suspected misclassifications.
- Bulk selection with sticky action bar (Rematch, Set Artwork, Add to Collection, Assign IDs).
- Acceptance: large lists are smooth; selections persist across pages where sensible.

Prompt 29: Item Detail View

- Tabs: Overview, Provider IDs, Artwork, Hierarchy, Change History.
- Quick match widget with ranked candidates and one-click assign; cascade options.
- Artwork gallery with source/language chips and apply buttons.
- Acceptance: end-to-end edit of IDs and artwork works.

Prompt 30: Search & Match UI

- Unified provider search with debounced input and merged results; source badges and confidence indicators.
- Side-by-side compare: current vs candidate.
- Bulk rematch flow initiation from here.
- Acceptance: matching a series and cascading to episodes works with clear confirmation.

Prompt 31: Bulk Operations UI

- Wizard: select scope (current selection or filter), choose operation, preview diffs, execute with progress.
- Live job status panel with per-item results and retry/skip actions.
- Export job results as JSON/CSV.
- Acceptance: complex bulk changes are safe and auditable.

Prompt 32: Collections UI

- Manual collections list and detail with member management.
- Smart collection builder with rule editor (form-based) and preview results.
- Rebuild trigger with progress feedback.
- Acceptance: creating and rebuilding collections is intuitive.

Prompt 33: Misclassification Review UI

- Queue list with evidence badges and scores.
- Bulk actions to add to holding collection or rematch to a series; preview changes.
- Acceptance: operator can clear queue efficiently and safely.

Settings And Operations Prompts

Prompt 34: Settings Screens

- Sections: Jellyfin, Providers, Application.
- Jellyfin: URL, API key, selected libraries; test connection button; save persists to backend.
- Providers: enable/disable TVMaze, Wikidata, TMDb key entry; language preferences for artwork.
- Application: base path, default locale, rate limits, concurrency; maintenance actions (resync, clear caches).
- Acceptance: settings persist and immediately affect behaviour.

Prompt 35: Reverse Proxy And Security

- Backend: trust proxy headers if TRUST_PROXY=true; disable CORS by default; add Helmet with conservative defaults (minus CSP for now).
- No in-app auth; ensure all secrets never reach the frontend.
- Acceptance: requests show correct client IP via proxy; no CORS preflights in same-origin.

Prompt 36: Observability And Error UX

- Standardise error responses with code, message, requestId.
- Frontend: toast and inline error patterns; link to logs via requestId.
- Add /api/health extended info: DB state, provider status, queue depth.
- Acceptance: failures are clear to users and actionable.

Testing And QA Prompts

Prompt 37: Backend Unit Tests

- Add Jest or Vitest to backend.
- Unit tests for provider adapters (with recorded fixtures), Jellyfin client, diff engine, and sync service.
- Acceptance: coverage threshold 80% for critical modules; tests stable offline using fixtures.

Prompt 38: Integration Tests With Jellyfin

- Use docker-compose to start a Jellyfin 10.10.7 test container with a seeded library (minimal sample).
- Run integration tests covering read/write flows including artwork upload and collection creation.
- Acceptance: CI can spin up Jellyfin and pass tests reliably.

Prompt 39: Frontend Tests

- Add Vitest and Svelte Testing Library for components.
- Add Playwright for E2E covering: search/match, bulk preview/execute, artwork selection, collection creation.
- Acceptance: headless E2E runs in CI with reasonable timings.

Prompt 40: Accessibility Pass

- Keyboard navigation, focus order, ARIA roles, labelling; test with axe and manual checks.
- Provide a high-contrast theme toggle.
- Acceptance: axe passes with no critical issues; keyboard-only usage is feasible.

Performance And Reliability Prompts

Prompt 41: Server-Side Pagination And Filtering

- Implement robust filtering and pagination for /api/items using SQL indexes.
- Add composite indexes for frequent queries (type, libraryId, flags).
- Acceptance: queries remain sub-200 ms on 100k+ items.

Prompt 42: Rate Limiting And Backoff

- Implement per-provider rate limits and exponential backoff with jitter on 429/5xx.
- Persist provider rate windows in SQLite to survive restarts.
- Acceptance: sustained operations do not violate provider limits.

Prompt 43: In-Memory Caches

- Add LRU caches for hot paths (provider lookups, artwork lists) with metrics and invalidation on updates.
- Acceptance: cache hit ratio is visible in logs; memory bounded.

Prompt 44: Concurrency Controls

- Global and per-provider concurrency limits; avoid overwhelming Jellyfin.
- Bulk executor honours concurrency and has stop-on-first-error option.
- Acceptance: stable under stress; no request floods.

API And Client Prompts

Prompt 45: OpenAPI Documentation

- Generate OpenAPI spec for backend routes; expose at /api/docs.json.
- Add a simple docs page linking to the JSON.
- Acceptance: spec validates; kept up to date with changes.

Prompt 46: Type-Safe Frontend API Client

- Generate or handcraft a typed client in frontend using the OpenAPI spec.
- Handle requestId headers and error mapping consistently.
- Acceptance: no any in client code; types align with backend DTOs.

Docker And CI Prompts

Prompt 47: Dockerfile Multi-Stage

- Create a single production Dockerfile:
  - Build frontend and backend, then produce a minimal runtime image.
  - Non-root user, expose APP_PORT, mount /data volume, healthcheck to /api/health.
- Acceptance: docker build produces a working image; size reasonable.

Prompt 48: Multi-Arch Build And Publish

- Add buildx scripts and a GitHub Actions workflow:
  - On tag push, build linux/amd64 and linux/arm64/v8 and push manifest to ghcr.io/seesee/metafin.
  - Cache dependencies; embed build metadata (git SHA, version).
- Acceptance: pulling latest on Apple Silicon and AMD64 selects correct arch and runs.

Prompt 49: docker-compose Examples

- Provide examples:
  - Standalone metafin
  - metafin + Jellyfin (for testing)
- Include env examples, volumes, reverse proxy notes.
- Acceptance: users can copy-paste to run locally.

Data And Migration Prompts

Prompt 50: Prisma Migrations And Seed

- Add initial migration and a seed script to populate a small demo dataset for UI dev (mock items, provider IDs, artwork candidates).
- Acceptance: pnpm db:migrate and pnpm db:seed work and are idempotent.

Prompt 51: Backup And Restore Guidance

- Document how to back up /data/app.db and restore safely.
- Add a maintenance endpoint to compact the SQLite database if needed.
- Acceptance: docs present and compact runs without downtime risk callouts.

Edge Cases And Hardening Prompts

Prompt 52: BASE_PATH Handling End-To-End

- Ensure both backend and frontend respect BASE_PATH/PUBLIC_BASE_PATH for all routes and asset URLs.
- Verify behind a reverse proxy on a subpath with path rewriting offloads.
- Acceptance: app works at / and at /metafin without broken links.

Prompt 53: Provider Fallbacks And Merges

- Implement logic to merge results from multiple providers with clear provenance.
- If TMDb unavailable, gracefully degrade artwork selection and explain in UI.
- Acceptance: UI clearly indicates which sources provided each field.

Prompt 54: Conflict Detection And Refresh

- When previewing changes, detect if the item changed in Jellyfin since last fetch; surface conflicts and offer to refetch before applying.
- Acceptance: conflicts are caught and prevent accidental overwrites.

Prompt 55: Operation Logs And Audits

- Persist operation_logs with before/after JSON snapshots and outcomes.
- Add a Change History tab in Item Detail using these logs.
- Acceptance: operators can see what changed, when, and why.

Prompt 56: Safety Rails For Bulk Changes

- Add global dry-run mode via env for admin validation.
- Add per-operation cap (e.g., max 10k items unless explicitly overridden).
- Acceptance: attempting large destructive changes prompts confirmation.

Developer Experience Prompts

Prompt 57: Makefile/NPM Scripts

- Add scripts for common tasks:
  - dev (both apps), build, test, lint, typecheck, db:migrate, db:reset, docker:build, docker:run.
- Acceptance: single commands streamline local development.

Prompt 58: Sample Provider Fixtures

- Record sample responses for TVMaze, Wikidata, TMDb in test fixtures with a wrapper to replay during tests.
- Acceptance: tests run offline deterministically.

Prompt 59: Documentation Sitelets

- Expand README with:
  - Architecture overview graphic (ASCII acceptable).
  - Provider model and how to add a new source.
  - i18n guidelines and translation contribution.
  - Troubleshooting Jellyfin connectivity.
- Acceptance: new contributors can be productive within an hour.

Prompt 60: Release Process

- Add a Release GitHub Action that:
  - Runs tests, builds, publishes images, creates a GitHub Release with notes.
  - Optionally integrate release-please for versioning.
- Acceptance: tagging v0.1.0 creates a release with assets and images available.

Nice-To-Have Prompts (Optional For v1)

Prompt 61: Undo (Soft) For Recent Changes

- Implement a short-lived undo queue (e.g., last 50 operations) to reapply previous values via stored beforeJson.
- Acceptance: simple revert works for recent edits when still valid.

Prompt 62: Provider ID Validation UI Helpers

- Frontend helpers to validate ID formats and inline verify via provider lookup.
- Acceptance: bad IDs flagged instantly with guidance.

Prompt 63: Advanced Search Query Language

- Add a simple query language for /api/items (e.g., missing:tmdb and type:episode and year:>2010).
- Acceptance: power users can craft filters quickly; UI composes queries.

Prompt 64: Telemetry-Free Metrics

- Log-based counters for key events (matches applied, images set, provider calls).
- Simple /api/metrics text endpoint (not Prometheus) summarising counts.
- Acceptance: ops can gauge usage without external services.

Final Acceptance Checklist Prompt

Prompt 65: v1 Acceptance Sweep

- Verify the following end-to-end using a Jellyfin 10.10.7 test server:
  - Connect metafin with admin API key and sync libraries.
  - Search and match a series; cascade matches to seasons and episodes.
  - Bulk rematch a selection; preview and apply provider IDs.
  - Set artwork for series and season using TMDb when available, fallback otherwise.
  - Create a smart collection and rebuild it.
  - Detect misclassified “films” and move them into a holding collection.
  - Trigger Jellyfin refresh and see updates reflected.
  - Build and run Docker images on AMD64 and Apple Silicon.
  - Switch UI language and confirm i18n coverage.
- Acceptance: all pass without manual intervention beyond configuration.
