# metafin Implementation TODO

This document tracks the methodical implementation of metafin based on the prompts in PROMPTS.md. Each section corresponds to a prompt group and maintains the original numbering for reference.

## ✅ COMPLETED Bootstrap And Tooling (Prompts 1-3)

### ✅ Prompt 1: Repository Scaffolding
- ✅ Create pnpm workspace repository structure with apps/backend, apps/frontend, packages/shared
- ✅ Add root configuration files (.editorconfig, .gitignore, .gitattributes, LICENSE, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)
- ✅ Configure pnpm workspace with lockfile and Node 20+ engines requirement
- ✅ Verify: pnpm install at root succeeds; both apps compile with placeholder endpoints

### ✅ Prompt 2: Code Quality And Conventions
- ✅ Add ESLint and Prettier configs with TypeScript and Svelte support, print width 80
- ✅ Enable strict TypeScript across all packages (noImplicitAny, strictNullChecks)
- ✅ Add Husky, lint-staged, and commitlint with Conventional Commits
- ✅ Verify: pnpm lint and pnpm format succeed; pre-commit hooks block broken code

### ✅ Prompt 3: Shared Package Setup
- ✅ Create packages/shared with core domain types (JellyfinItem, ItemType, etc.)
- ✅ Add utility functions (title normalisation, safe fetch, LRU cache, rate limiter)
- ✅ Add error classes (AppError with structured codes)
- ✅ Verify: shared package builds and types are consumed by both apps

## ✅ COMPLETED Backend Core (Prompts 4-7)

### ✅ Prompt 4: NestJS App Skeleton
- ✅ Scaffold NestJS backend with core modules (App, Config, Logger, Health)
- ✅ Add class-validator for DTO validation, global pipes and exception filter
- ✅ Implement /api/health endpoint with version, uptime, build info
- ✅ Verify: pnpm dev starts backend; curl /api/health returns 200 JSON

### ✅ Prompt 5: Configuration And Environment
- ✅ Implement strongly typed configuration service with all required env vars
- ✅ Add schema validation and runtime reload for setup changes
- ✅ Ensure BASE_PATH is respected for all routes
- ✅ Verify: invalid env fails fast; BASE_PATH is honoured

### ✅ Prompt 6: SQLite And Prisma
- ✅ Add Prisma with SQLite datasource and complete initial schema
- ✅ Create DatabaseService with health checks and migrations runner
- ✅ Verify: pnpm prisma migrate dev works; backend ensures schema is current

### ✅ Prompt 7: Logger And Request Context
- ✅ Add structured logging with requestId and jobId correlation
- ✅ Implement middleware for requestId assignment and response headers
- ✅ Ensure secrets are redacted in logs
- ✅ Verify: logs contain requestId; no secrets appear in logs

## ✅ PARTIALLY COMPLETED Jellyfin Integration (Prompts 8-10)

### ✅ Prompt 8: Jellyfin HTTP Client (10.10.7)
- ✅ Implement typed Jellyfin client with all required methods
- ✅ Handle errors and map to AppError with proper status codes
- ✅ Verify: client works against Jellyfin 10.10.7 in tests

### ✅ Prompt 9: Jellyfin Cache And Sync Service
- ✅ Implement LibrarySyncService with full and incremental sync
- ✅ Store path-derived heuristics and hierarchy relationships
- ✅ Verify: items table mirrors Jellyfin with correct parent-child links

### 🔄 Prompt 10: Jellyfin Write Operations
- ✅ Implement update functions for provider IDs, metadata, artwork
- ✅ Add collection management and metadata refresh triggers
- ✅ Ensure idempotency and retries with exponential backoff
- ✅ Verify: updates reflect in Jellyfin UI; retries work on transient errors

## ✅ PARTIALLY COMPLETED Provider Framework (Prompts 11-14)

### ✅ Prompt 11: Provider Abstraction
- ✅ Define Provider interface with capability flags and methods
- ✅ Create ProviderRegistry with rate limits and error wrapping
- ✅ Verify: registry lists providers and enforces capability checks

### ✅ Prompt 12: TVMaze Provider
- ✅ Implement TVMaze adapter with search and episode mapping
- ✅ Add SQLite caching with TTL and rate limit compliance
- ✅ Verify: searching "Doctor Who" returns ranked candidates with episodes

### ✅ Prompt 13: Wikidata Provider
- ✅ Implement Wikidata adapter with SPARQL and multilingual support
- ✅ Add caching and query throttling
- ✅ Verify: known series returns entity ID and labels in multiple languages

### 🔄 Prompt 14: TMDb Provider (Optional)
- [ ] Implement TMDb adapter with API key gating
- [ ] Support TV series search and artwork fetching by language
- [ ] Verify: with API key, artwork candidates include TMDb images with metadata

## 🎯 IN PROGRESS Diff And Bulk Operations (Prompts 15-17)

### 🔄 Prompt 15: Diff Engine
- [ ] Implement diff engine comparing current vs proposed metadata changes
- [ ] Support all metadata types with conflict detection
- [ ] Verify: returns deterministic diffs; empty diff for no-ops

### 🔄 Prompt 16: Bulk Operations Model And API
- [ ] Create DTOs and endpoints for preview/execute operations
- [ ] Implement job persistence and status tracking in SQLite
- [ ] Verify: end-to-end preview and execution works with real-time job status

### 🔄 Prompt 17: Bulk Rematch
- [ ] Implement bulk provider assignment endpoint with preview
- [ ] Support season/episode mapping by number or air date
- [ ] Verify: many episodes rematched reliably with clear preview

## ✅ PARTIALLY COMPLETED Artwork (Prompts 18-19)

### ✅ Prompt 18: Artwork Aggregation
- ✅ Implement artwork candidates API aggregating all sources
- ✅ Add caching with TTL and manual refresh capability
- ✅ Verify: UI receives sorted candidates by quality and language

### ✅ Prompt 19: Artwork Apply
- ✅ Implement artwork selection endpoint with download and upload
- ✅ Validate formats/sizes and ensure original quality
- ✅ Verify: selected artwork appears in Jellyfin immediately

## ✅ PARTIALLY COMPLETED Collections (Prompts 20-21)

### ✅ Prompt 20: Manual Collections
- ✅ Implement manual collection CRUD endpoints
- ✅ Sync Jellyfin collection state to local cache
- ✅ Verify: collection creation and management reflects in Jellyfin UI

### 🔄 Prompt 21: Smart Collections (Rules-Based)
- [ ] Define rule JSON schema and server-side evaluator
- [ ] Implement smart collection creation and materialisation endpoints
- [ ] Verify: smart collections yield expected members; rebuild works

## 🎯 IN PROGRESS Misclassification Detection (Prompts 22-23)

### 🔄 Prompt 22: Heuristics And Queue
- [ ] Implement scoring function for "looks like movies" detection
- [ ] Store suspectedMisclassification flags with scores and reasons
- [ ] Provide review queue endpoint with suggested actions
- [ ] Verify: list shows realistic suspects with evidence

### 🔄 Prompt 23: Resolution Actions
- [ ] Implement API actions for suspected items (collections, rematch)
- [ ] Provide actionable guidance for unsupported conversions
- [ ] Verify: bulk actions operate with preview and clear outcomes

## ✅ PARTIALLY COMPLETED Frontend Core (Prompts 24-33)

### ✅ Prompt 24: SvelteKit App Skeleton
- ✅ Scaffold SvelteKit frontend with TypeScript and Tailwind
- ✅ Configure PUBLIC_BASE_PATH support and API client wrapper
- ✅ Verify: dev server runs; health status shown on home page

### 🔄 Prompt 25: i18n Setup
- [ ] Integrate i18next with en-GB default and runtime language switcher
- [ ] Implement missing-key warnings and Intl date/time formatting
- [ ] Verify: language switching works; strings resolve correctly

### ✅ Prompt 26: Global Navigation And Layout
- ✅ Implement responsive layout with navigation and breadcrumbs
- ✅ Add light/dark and high-contrast themes
- ✅ Verify: navigation works; keyboard accessible

### ✅ Prompt 27: Dashboard
- ✅ Create dashboard cards for missing IDs, artwork, misclassifications, jobs
- ✅ Add quick actions for sync, review queue, collections
- ✅ Verify: cards query backend and update live

### ✅ Prompt 28: Library Browser With Filters
- ✅ Implement virtualised grid/list with server-side pagination
- ✅ Add comprehensive filters and bulk selection with sticky actions
- ✅ Verify: large lists are smooth; selections persist across pages

### ✅ Prompt 29: Item Detail View
- ✅ Create tabbed detail view with overview, IDs, artwork, hierarchy, history
- ✅ Add quick match widget and artwork gallery with apply buttons
- ✅ Verify: end-to-end edit of IDs and artwork works

### 🔄 Prompt 30: Search & Match UI
- [ ] Implement unified provider search with debounced input
- [ ] Add side-by-side compare and bulk rematch flow initiation
- [ ] Verify: series matching and cascading to episodes works with confirmation

### 🔄 Prompt 31: Bulk Operations UI
- [ ] Create wizard for scope selection, operation choice, preview, execution
- [ ] Add live job status panel with per-item results and retry actions
- [ ] Support export of job results as JSON/CSV
- [ ] Verify: complex bulk changes are safe and auditable

### ✅ Prompt 32: Collections UI
- ✅ Implement manual collections list and detail with member management
- 🔄 Create smart collection builder with rule editor and preview
- 🔄 Add rebuild trigger with progress feedback
- ✅ Verify: creating and rebuilding collections is intuitive

### 🔄 Prompt 33: Misclassification Review UI
- [ ] Create queue list with evidence badges and scores
- [ ] Implement bulk actions for holding collection or rematch with preview
- [ ] Verify: operators can clear queue efficiently and safely

## ✅ PARTIALLY COMPLETED Settings And Operations (Prompts 34-36)

### ✅ Prompt 34: Settings Screens
- ✅ Create settings sections for Jellyfin, Providers, Application
- ✅ Implement connection testing and persistence to backend
- ✅ Verify: settings persist and immediately affect behaviour

### ✅ Prompt 35: Reverse Proxy And Security
- ✅ Configure proxy headers trust and disable CORS by default
- ✅ Add Helmet with conservative defaults (minus CSP)
- ✅ Verify: correct client IP via proxy; no CORS preflights same-origin

### ✅ Prompt 36: Observability And Error UX
- ✅ Standardise error responses with codes and requestId
- ✅ Implement toast/inline error patterns with log correlation
- ✅ Extend /api/health with DB state and provider status
- ✅ Verify: failures are clear and actionable to users

## 🎯 HIGH PRIORITY REMAINING WORK

### Next 3 Critical Prompts to Complete:

#### 1. **Prompt 15: Diff Engine** (Foundation for Bulk Operations)
Implement diff engine comparing current vs proposed metadata changes with conflict detection. This is essential for safe bulk operations.

#### 2. **Prompt 16: Bulk Operations Model And API** (Core Functionality Gap)
Create DTOs and endpoints for preview/execute operations with job persistence. This completes the bulk editing functionality that was partially implemented.

#### 3. **Prompt 30: Search & Match UI** (User Experience Gap)
Implement unified provider search with debounced input and bulk rematch flow. This is crucial for the core matching workflow.

## 🔄 REMAINING WORK BY CATEGORY

### Testing And QA (Prompts 37-40) - HIGH PRIORITY
- [ ] **Prompt 37**: Backend unit tests with provider fixtures
- [ ] **Prompt 38**: Integration tests with Jellyfin 10.10.7 container
- [ ] **Prompt 39**: Frontend component and E2E tests
- [ ] **Prompt 40**: Accessibility pass with axe and keyboard testing

### Performance And Reliability (Prompts 41-44) - MEDIUM PRIORITY
- [ ] **Prompt 41**: Server-side pagination optimisation with indexes
- [ ] **Prompt 42**: Rate limiting and backoff improvements
- [ ] **Prompt 43**: In-memory caches for hot paths
- [ ] **Prompt 44**: Concurrency controls

### API And Client (Prompts 45-46) - MEDIUM PRIORITY
- [ ] **Prompt 45**: OpenAPI documentation generation
- [ ] **Prompt 46**: Type-safe frontend API client

### Docker And CI (Prompts 47-49) - HIGH PRIORITY FOR DEPLOYMENT
- [ ] **Prompt 47**: Multi-stage Dockerfile production build
- [ ] **Prompt 48**: Multi-arch build pipeline (AMD64/ARM64)
- [ ] **Prompt 49**: Docker Compose examples

### Data And Migration (Prompts 50-51) - LOW PRIORITY
- [ ] **Prompt 50**: Prisma migrations and seed data
- [ ] **Prompt 51**: Backup and restore guidance

### Edge Cases And Hardening (Prompts 52-56) - MEDIUM PRIORITY
- [ ] **Prompt 52**: BASE_PATH end-to-end verification
- [ ] **Prompt 53**: Provider fallbacks and merges
- [ ] **Prompt 54**: Conflict detection and refresh
- [ ] **Prompt 55**: Operation logs and audits
- [ ] **Prompt 56**: Safety rails for bulk changes

### Developer Experience (Prompts 57-60) - LOW PRIORITY
- [ ] **Prompt 57**: NPM scripts standardisation
- [ ] **Prompt 58**: Provider fixtures for offline testing
- [ ] **Prompt 59**: Documentation expansion
- [ ] **Prompt 60**: Release process automation

### Nice-To-Have (Prompts 61-64) - LOWEST PRIORITY
- [ ] **Prompt 61**: Undo functionality
- [ ] **Prompt 62**: Provider ID validation helpers
- [ ] **Prompt 63**: Advanced search query language
- [ ] **Prompt 64**: Telemetry-free metrics

### Final Acceptance (Prompt 65) - VALIDATION
- [ ] **Prompt 65**: Complete end-to-end acceptance testing

## 🚀 RECOMMENDED NEXT STEPS

### Phase 1: Complete Core Functionality (Weeks 1-2)
1. **Prompt 15**: Diff Engine implementation
2. **Prompt 16**: Bulk Operations API completion
3. **Prompt 30**: Search & Match UI

### Phase 2: Quality & Testing (Week 3)
1. **Prompt 37**: Backend unit tests
2. **Prompt 38**: Integration tests
3. **Prompt 39**: Frontend tests

### Phase 3: Production Readiness (Week 4)
1. **Prompt 47**: Production Dockerfile
2. **Prompt 48**: Multi-arch CI/CD
3. **Prompt 40**: Accessibility pass

### Phase 4: Polish & Advanced Features (Week 5-6)
1. **Prompt 25**: i18n implementation
2. **Prompt 22-23**: Misclassification detection
3. **Prompt 21**: Smart collections
4. **Prompt 31**: Bulk Operations UI completion

## 📊 CURRENT STATUS SUMMARY

**Overall Completion: ~70%**

- ✅ **Infrastructure & Core**: 95% complete
- ✅ **Basic UI & Navigation**: 90% complete
- ✅ **Jellyfin Integration**: 85% complete
- ✅ **Provider Framework**: 80% complete
- 🔄 **Bulk Operations**: 60% complete (API partial, UI needs work)
- 🔄 **Advanced Features**: 40% complete
- ❌ **Testing**: 20% complete
- ❌ **Production Deployment**: 30% complete

## 🎯 CRITICAL PATH

The most important items to focus on for a functional v1 release:

1. **Diff Engine** (Prompt 15) - Enables safe bulk operations
2. **Bulk Operations API** (Prompt 16) - Completes backend functionality
3. **Search & Match UI** (Prompt 30) - Core user workflow
4. **Testing Suite** (Prompts 37-39) - Quality assurance
5. **Production Build** (Prompts 47-48) - Deployment readiness

## Implementation Notes

- Follow CLAUDE.md guidelines throughout implementation
- Keep PRs small and focused on single prompts where possible
- Maintain British English for all user-facing text
- Ensure BASE_PATH support is tested at each stage
- Use TypeScript strict mode and maintain high code quality
- Test against Jellyfin 10.10.7 consistently
- Prioritise accessibility and i18n from the start
- Use conventional commits and maintain clear commit history