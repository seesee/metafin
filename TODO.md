# metafin Implementation TODO

This document tracks the methodical implementation of metafin based on the prompts in PROMPTS.md. Each section corresponds to a prompt group and maintains the original numbering for reference.

## Bootstrap And Tooling (Prompts 1-3)

### Prompt 1: Repository Scaffolding

- [ ] Create pnpm workspace repository structure with apps/backend, apps/frontend, packages/shared
- [ ] Add root configuration files (.editorconfig, .gitignore, .gitattributes, LICENSE, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)
- [ ] Configure pnpm workspace with lockfile and Node 20+ engines requirement
- [ ] Verify: pnpm install at root succeeds; both apps compile with placeholder endpoints

### Prompt 2: Code Quality And Conventions

- [ ] Add ESLint and Prettier configs with TypeScript and Svelte support, print width 80
- [ ] Enable strict TypeScript across all packages (noImplicitAny, strictNullChecks)
- [ ] Add Husky, lint-staged, and commitlint with Conventional Commits
- [ ] Verify: pnpm lint and pnpm format succeed; pre-commit hooks block broken code

### Prompt 3: Shared Package Setup

- [ ] Create packages/shared with core domain types (JellyfinItem, ItemType, etc.)
- [ ] Add utility functions (title normalisation, safe fetch, LRU cache, rate limiter)
- [ ] Add error classes (AppError with structured codes)
- [ ] Verify: shared package builds and types are consumed by both apps

## Backend Core (Prompts 4-7)

### Prompt 4: NestJS App Skeleton

- [ ] Scaffold NestJS backend with core modules (App, Config, Logger, Health)
- [ ] Add class-validator for DTO validation, global pipes and exception filter
- [ ] Implement /api/health endpoint with version, uptime, build info
- [ ] Verify: pnpm dev starts backend; curl /api/health returns 200 JSON

### Prompt 5: Configuration And Environment

- [ ] Implement strongly typed configuration service with all required env vars
- [ ] Add schema validation and runtime reload for setup changes
- [ ] Ensure BASE_PATH is respected for all routes
- [ ] Verify: invalid env fails fast; BASE_PATH is honoured

### Prompt 6: SQLite And Prisma

- [ ] Add Prisma with SQLite datasource and complete initial schema
- [ ] Create DatabaseService with health checks and migrations runner
- [ ] Verify: pnpm prisma migrate dev works; backend ensures schema is current

### Prompt 7: Logger And Request Context

- [ ] Add structured logging with requestId and jobId correlation
- [ ] Implement middleware for requestId assignment and response headers
- [ ] Ensure secrets are redacted in logs
- [ ] Verify: logs contain requestId; no secrets appear in logs

## Jellyfin Integration (Prompts 8-10)

### Prompt 8: Jellyfin HTTP Client (10.10.7)

- [ ] Implement typed Jellyfin client with all required methods
- [ ] Handle errors and map to AppError with proper status codes
- [ ] Verify: client works against Jellyfin 10.10.7 in tests

### Prompt 9: Jellyfin Cache And Sync Service

- [ ] Implement LibrarySyncService with full and incremental sync
- [ ] Store path-derived heuristics and hierarchy relationships
- [ ] Verify: items table mirrors Jellyfin with correct parent-child links

### Prompt 10: Jellyfin Write Operations

- [ ] Implement update functions for provider IDs, metadata, artwork
- [ ] Add collection management and metadata refresh triggers
- [ ] Ensure idempotency and retries with exponential backoff
- [ ] Verify: updates reflect in Jellyfin UI; retries work on transient errors

## Provider Framework (Prompts 11-14)

### Prompt 11: Provider Abstraction

- [ ] Define Provider interface with capability flags and methods
- [ ] Create ProviderRegistry with rate limits and error wrapping
- [ ] Verify: registry lists providers and enforces capability checks

### Prompt 12: TVMaze Provider

- [ ] Implement TVMaze adapter with search and episode mapping
- [ ] Add SQLite caching with TTL and rate limit compliance
- [ ] Verify: searching "Doctor Who" returns ranked candidates with episodes

### Prompt 13: Wikidata Provider

- [ ] Implement Wikidata adapter with SPARQL and multilingual support
- [ ] Add caching and query throttling
- [ ] Verify: known series returns entity ID and labels in multiple languages

### Prompt 14: TMDb Provider (Optional)

- [ ] Implement TMDb adapter with API key gating
- [ ] Support TV series search and artwork fetching by language
- [ ] Verify: with API key, artwork candidates include TMDb images with metadata

## Diff And Bulk Operations (Prompts 15-17)

### Prompt 15: Diff Engine

- [ ] Implement diff engine comparing current vs proposed metadata changes
- [ ] Support all metadata types with conflict detection
- [ ] Verify: returns deterministic diffs; empty diff for no-ops

### Prompt 16: Bulk Operations Model And API

- [ ] Create DTOs and endpoints for preview/execute operations
- [ ] Implement job persistence and status tracking in SQLite
- [ ] Verify: end-to-end preview and execution works with real-time job status

### Prompt 17: Bulk Rematch

- [ ] Implement bulk provider assignment endpoint with preview
- [ ] Support season/episode mapping by number or air date
- [ ] Verify: many episodes rematched reliably with clear preview

## Artwork (Prompts 18-19)

### Prompt 18: Artwork Aggregation

- [ ] Implement artwork candidates API aggregating all sources
- [ ] Add caching with TTL and manual refresh capability
- [ ] Verify: UI receives sorted candidates by quality and language

### Prompt 19: Artwork Apply

- [ ] Implement artwork selection endpoint with download and upload
- [ ] Validate formats/sizes and ensure original quality
- [ ] Verify: selected artwork appears in Jellyfin immediately

## Collections (Prompts 20-21)

### Prompt 20: Manual Collections

- [ ] Implement manual collection CRUD endpoints
- [ ] Sync Jellyfin collection state to local cache
- [ ] Verify: collection creation and management reflects in Jellyfin UI

### Prompt 21: Smart Collections (Rules-Based)

- [ ] Define rule JSON schema and server-side evaluator
- [ ] Implement smart collection creation and materialisation endpoints
- [ ] Verify: smart collections yield expected members; rebuild works

## Misclassification Detection (Prompts 22-23)

### Prompt 22: Heuristics And Queue

- [ ] Implement scoring function for "looks like movies" detection
- [ ] Store suspectedMisclassification flags with scores and reasons
- [ ] Provide review queue endpoint with suggested actions
- [ ] Verify: list shows realistic suspects with evidence

### Prompt 23: Resolution Actions

- [ ] Implement API actions for suspected items (collections, rematch)
- [ ] Provide actionable guidance for unsupported conversions
- [ ] Verify: bulk actions operate with preview and clear outcomes

## Frontend Core (Prompts 24-33)

### Prompt 24: SvelteKit App Skeleton

- [ ] Scaffold SvelteKit frontend with TypeScript and Tailwind
- [ ] Configure PUBLIC_BASE_PATH support and API client wrapper
- [ ] Verify: dev server runs; health status shown on home page

### Prompt 25: i18n Setup

- [ ] Integrate i18next with en-GB default and runtime language switcher
- [ ] Implement missing-key warnings and Intl date/time formatting
- [ ] Verify: language switching works; strings resolve correctly

### Prompt 26: Global Navigation And Layout

- [ ] Implement responsive layout with navigation and breadcrumbs
- [ ] Add light/dark and high-contrast themes
- [ ] Verify: navigation works; keyboard accessible

### Prompt 27: Dashboard

- [ ] Create dashboard cards for missing IDs, artwork, misclassifications, jobs
- [ ] Add quick actions for sync, review queue, collections
- [ ] Verify: cards query backend and update live

### Prompt 28: Library Browser With Filters

- [ ] Implement virtualised grid/list with server-side pagination
- [ ] Add comprehensive filters and bulk selection with sticky actions
- [ ] Verify: large lists are smooth; selections persist across pages

### Prompt 29: Item Detail View

- [ ] Create tabbed detail view with overview, IDs, artwork, hierarchy, history
- [ ] Add quick match widget and artwork gallery with apply buttons
- [ ] Verify: end-to-end edit of IDs and artwork works

### Prompt 30: Search & Match UI

- [ ] Implement unified provider search with debounced input
- [ ] Add side-by-side compare and bulk rematch flow initiation
- [ ] Verify: series matching and cascading to episodes works with confirmation

### Prompt 31: Bulk Operations UI

- [ ] Create wizard for scope selection, operation choice, preview, execution
- [ ] Add live job status panel with per-item results and retry actions
- [ ] Support export of job results as JSON/CSV
- [ ] Verify: complex bulk changes are safe and auditable

### Prompt 32: Collections UI

- [ ] Implement manual collections list and detail with member management
- [ ] Create smart collection builder with rule editor and preview
- [ ] Add rebuild trigger with progress feedback
- [ ] Verify: creating and rebuilding collections is intuitive

### Prompt 33: Misclassification Review UI

- [ ] Create queue list with evidence badges and scores
- [ ] Implement bulk actions for holding collection or rematch with preview
- [ ] Verify: operators can clear queue efficiently and safely

## Settings And Operations (Prompts 34-36)

### Prompt 34: Settings Screens

- [ ] Create settings sections for Jellyfin, Providers, Application
- [ ] Implement connection testing and persistence to backend
- [ ] Verify: settings persist and immediately affect behaviour

### Prompt 35: Reverse Proxy And Security

- [ ] Configure proxy headers trust and disable CORS by default
- [ ] Add Helmet with conservative defaults (minus CSP)
- [ ] Verify: correct client IP via proxy; no CORS preflights same-origin

### Prompt 36: Observability And Error UX

- [ ] Standardise error responses with codes and requestId
- [ ] Implement toast/inline error patterns with log correlation
- [ ] Extend /api/health with DB state and provider status
- [ ] Verify: failures are clear and actionable to users

## Testing And QA (Prompts 37-40)

### Prompt 37: Backend Unit Tests

- [ ] Add Jest/Vitest with unit tests for providers, client, diff engine, sync
- [ ] Use recorded fixtures for offline testing
- [ ] Verify: 80% coverage threshold for critical modules; stable offline tests

### Prompt 38: Integration Tests With Jellyfin

- [ ] Create docker-compose with Jellyfin 10.10.7 test container
- [ ] Implement integration tests for read/write flows
- [ ] Verify: CI can spin up Jellyfin and pass tests reliably

### Prompt 39: Frontend Tests

- [ ] Add Vitest and Svelte Testing Library for components
- [ ] Implement Playwright E2E for critical flows
- [ ] Verify: headless E2E runs in CI with reasonable timings

### Prompt 40: Accessibility Pass

- [ ] Implement keyboard navigation, ARIA roles, focus management
- [ ] Add high-contrast theme toggle and axe testing
- [ ] Verify: axe passes with no critical issues; keyboard-only usage feasible

## Performance And Reliability (Prompts 41-44)

### Prompt 41: Server-Side Pagination And Filtering

- [ ] Implement robust filtering/pagination with SQL indexes
- [ ] Add composite indexes for frequent queries
- [ ] Verify: queries remain sub-200ms on 100k+ items

### Prompt 42: Rate Limiting And Backoff

- [ ] Implement per-provider rate limits with exponential backoff and jitter
- [ ] Persist rate windows in SQLite to survive restarts
- [ ] Verify: sustained operations don't violate provider limits

### Prompt 43: In-Memory Caches

- [ ] Add LRU caches for hot paths with metrics and invalidation
- [ ] Verify: cache hit ratio visible in logs; memory bounded

### Prompt 44: Concurrency Controls

- [ ] Implement global and per-provider concurrency limits
- [ ] Add stop-on-first-error option to bulk executor
- [ ] Verify: stable under stress; no request floods

## API And Client (Prompts 45-46)

### Prompt 45: OpenAPI Documentation

- [ ] Generate OpenAPI spec and expose at /api/docs.json
- [ ] Add simple docs page linking to JSON spec
- [ ] Verify: spec validates and stays current with changes

### Prompt 46: Type-Safe Frontend API Client

- [ ] Generate/craft typed client using OpenAPI spec
- [ ] Handle requestId headers and error mapping consistently
- [ ] Verify: no any types in client code; types align with backend DTOs

## Docker And CI (Prompts 47-49)

### Prompt 47: Dockerfile Multi-Stage

- [ ] Create production Dockerfile with frontend and backend build
- [ ] Use non-root user, expose APP_PORT, mount /data, add healthcheck
- [ ] Verify: docker build produces working image with reasonable size

### Prompt 48: Multi-Arch Build And Publish

- [ ] Add buildx scripts and GitHub Actions workflow for multi-arch
- [ ] Build linux/amd64 and linux/arm64/v8, push to ghcr.io
- [ ] Cache dependencies and embed build metadata
- [ ] Verify: multi-arch images work on both Apple Silicon and AMD64

### Prompt 49: docker-compose Examples

- [ ] Provide standalone metafin and metafin + Jellyfin examples
- [ ] Include env examples, volumes, reverse proxy notes
- [ ] Verify: users can copy-paste to run locally

## Data And Migration (Prompts 50-51)

### Prompt 50: Prisma Migrations And Seed

- [ ] Add initial migration and seed script with demo dataset
- [ ] Verify: pnpm db:migrate and pnpm db:seed work and are idempotent

### Prompt 51: Backup And Restore Guidance

- [ ] Document SQLite backup/restore procedures
- [ ] Add maintenance endpoint for database compaction
- [ ] Verify: docs present and compact runs safely

## Edge Cases And Hardening (Prompts 52-56)

### Prompt 52: BASE_PATH Handling End-To-End

- [ ] Verify both backend and frontend respect BASE_PATH for all routes/assets
- [ ] Test behind reverse proxy on subpath with path rewriting
- [ ] Verify: app works at / and at /metafin without broken links

### Prompt 53: Provider Fallbacks And Merges

- [ ] Implement logic to merge results from multiple providers with provenance
- [ ] Handle TMDb unavailability gracefully with UI explanation
- [ ] Verify: UI clearly indicates which sources provided each field

### Prompt 54: Conflict Detection And Refresh

- [ ] Detect item changes in Jellyfin since last fetch during preview
- [ ] Surface conflicts and offer refetch before applying changes
- [ ] Verify: conflicts caught and prevent accidental overwrites

### Prompt 55: Operation Logs And Audits

- [ ] Persist operation_logs with before/after JSON snapshots
- [ ] Add Change History tab using operation logs
- [ ] Verify: operators can see what changed, when, and why

### Prompt 56: Safety Rails For Bulk Changes

- [ ] Add global dry-run mode via env and per-operation caps
- [ ] Verify: large destructive changes prompt confirmation

## Developer Experience (Prompts 57-60)

### Prompt 57: Makefile/NPM Scripts

- [ ] Add scripts for dev, build, test, lint, typecheck, db operations, docker
- [ ] Verify: single commands streamline local development

### Prompt 58: Sample Provider Fixtures

- [ ] Record sample responses for all providers with replay wrapper
- [ ] Verify: tests run offline deterministically

### Prompt 59: Documentation Sitelets

- [ ] Expand README with architecture, provider model, i18n, troubleshooting
- [ ] Verify: new contributors can be productive within an hour

### Prompt 60: Release Process

- [ ] Add Release GitHub Action with tests, build, publish, release notes
- [ ] Optionally integrate release-please for versioning
- [ ] Verify: tagging creates release with assets and images

## Nice-To-Have (Prompts 61-64) - Optional for v1

### Prompt 61: Undo (Soft) For Recent Changes

- [ ] Implement short-lived undo queue using stored beforeJson
- [ ] Verify: simple revert works for recent edits when still valid

### Prompt 62: Provider ID Validation UI Helpers

- [ ] Add frontend helpers for ID format validation and inline verification
- [ ] Verify: bad IDs flagged instantly with guidance

### Prompt 63: Advanced Search Query Language

- [ ] Add simple query language for /api/items filtering
- [ ] Verify: power users can craft filters quickly; UI composes queries

### Prompt 64: Telemetry-Free Metrics

- [ ] Implement log-based counters and /api/metrics text endpoint
- [ ] Verify: ops can gauge usage without external services

## Final Acceptance (Prompt 65)

### Prompt 65: v1 Acceptance Sweep

- [ ] Verify end-to-end flows against Jellyfin 10.10.7 test server
- [ ] Test connect, sync, match, bulk operations, artwork, collections, misclassification detection
- [ ] Verify Docker images work on both AMD64 and Apple Silicon
- [ ] Test UI language switching and i18n coverage
- [ ] Verify all flows pass without manual intervention beyond configuration

## Implementation Notes

- Follow CLAUDE.md guidelines throughout implementation
- Keep PRs small and focused on single prompts where possible
- Maintain British English for all user-facing text
- Ensure BASE_PATH support is tested at each stage
- Use TypeScript strict mode and maintain high code quality
- Test against Jellyfin 10.10.7 consistently
- Prioritise accessibility and i18n from the start
- Use conventional commits and maintain clear commit history
