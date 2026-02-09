# Session Notes — Code Audit, Fixes & Planning

This document captures everything done during the review session on this repo. Use it as context when starting the new repo based on this codebase.

---

## Background

This repo was inherited from a previous author who built a Babylon.js MCP server using Claude Code. The original author's roadmap, CLAUDE.md, and various docs were significantly out of date relative to the actual codebase. This session audited the code, fixed all found issues, brought documentation in sync, and captured ideas for a future rewrite.

---

## What the Repo Does (As-Is)

A TypeScript MCP server that gives AI agents access to Babylon.js knowledge through 6 tools:

| Tool | Purpose |
|---|---|
| `search_babylon_docs` | Semantic search across Babylon.js documentation (~745 files) |
| `get_babylon_doc` | Retrieve full content of a specific doc page |
| `search_babylon_api` | Search TypeDoc-extracted API docs (~144 entries) |
| `search_babylon_source` | Semantic search through Babylon.js source code |
| `get_babylon_source` | Retrieve specific source files or line ranges |
| `search_babylon_editor_docs` | Search Babylon.js Editor documentation (~13 pages) |

**Stack**: Express 5 + MCP SDK (StreamableHTTPServerTransport) + LanceDB + @xenova/transformers (local embeddings, Xenova/all-MiniLM-L6-v2, 384 dimensions).

**How it works**: Clones Babylon.js repos locally, parses markdown/TSX/TypeDoc, generates vector embeddings, stores in LanceDB. MCP tools perform semantic similarity search against those vectors.

---

## What Was Done This Session

### Phase 1: Full Codebase Audit

Analyzed every source file and identified ~18 issues across these categories:

#### CRITICAL — Security Vulnerabilities (Fixed)
1. **SQL injection in LanceDB `.where()` clauses** — All search handlers passed user input directly into string-interpolated where clauses like `` `category = '${options.category}'` ``. Created `src/search/input-sanitizer.ts` with `sanitizeWhereValue()` and `buildWhereClause()` functions that escape single quotes, strip null bytes and control characters.

2. **Path traversal in `getSourceFile()`** — The `get_babylon_source` tool accepted arbitrary file paths without validation. A request for `../../etc/passwd` would read any file on disk. Added `resolveSecurePath()` that uses `path.resolve()` + prefix check to ensure the resolved path stays within the Babylon.js repo directory.

3. **No request body size limit** — Express accepted unbounded JSON payloads. Added `express.json({ limit: '1mb' })` to `routes.ts`.

#### HIGH — Bugs & Race Conditions (Fixed)
4. **Race condition in search singleton** — `search-instance.ts` had a check-then-set pattern that allowed multiple concurrent `initialize()` calls. Replaced with a promise-based mutex: store the initialization promise itself (not the resolved instance), so all callers await the same promise.

5. **No Zod input bounds** — All 6 tool schemas accepted unbounded strings and numbers. Added `.min(1).max(500)` to queries, `.max(100)` to category/package, `.min(1).max(50)` to limit parameters.

6. **Double `split('\n')` in get-source handler** — Source code was split into lines twice, wasting memory. Cached into a `const lines` variable.

7. **Version mismatch** — `config.ts` said `1.1.0`, `package.json` said `1.0.0`. Fixed config to match.

8. **`any` types in editor handler** — Search results typed as `any` instead of `SearchResult`. Fixed with proper imports.

#### MEDIUM — Infrastructure (Fixed)
9. **No shutdown timeout** — `server.ts` could hang forever on `httpServer.close()`. Added 5-second timeout with `setTimeout` + `clearTimeout`.

10. **Unused dependencies** — Removed `nodemon` and `ts-node` from devDependencies (project uses `tsx`).

11. **Stale tsconfig options** — Removed `importHelpers: true` (no tslib installed) and the `ts-node` block.

12. **MCP SDK security vulnerabilities** — `npm audit` showed 5 vulnerabilities. Resolved by updating to SDK 1.26.0.

13. **Transport type incompatibility** — `exactOptionalPropertyTypes` caused type errors with MCP SDK's `onclose` and `sessionIdGenerator`. Fixed with targeted casts and comments explaining why.

#### LOW — Code Quality (Fixed)
14. **`withErrorHandling` lost handler types** — Changed from concrete function type to generic `<T extends HandlerFunction>` to preserve handler signatures through the wrapper.

15. **Error handler `content[].type`** — Was `string`, needed `'text'` literal to match MCP SDK expectations.

#### Tests (Fixed & Added)
16. **16 non-hermetic tests** — `handlers.test.ts` (7 tests) and `document-parser.test.ts` (9 tests) depended on real LanceDB data and external repo files. Rewrote with comprehensive mocks.

17. **New test suites created**:
    - `input-sanitizer.test.ts` — 20 tests (SQL injection, path traversal, edge cases)
    - `search-instance.test.ts` — 8 tests (singleton, race conditions, reset, error retry)

18. **Existing test suites updated**: `error-handlers.test.ts`, `transport.test.ts`, `search-editor-docs.handler.test.ts` — all updated for new type signatures and behavior.

**Final state**: 213 tests passing, 0 typecheck errors, 0 npm audit vulnerabilities.

### Phase 2: Documentation Overhaul

The CLAUDE.md and supporting docs were severely outdated. Fixed:

| File | What Changed |
|---|---|
| **CLAUDE.md** | Full rewrite: actual project structure (handlers/ subdirectory, src/search/, scripts/), all 6 tools documented (was 2 with "Placeholder" labels), 14 test suites / 213 tests (was 5 / ~73), SDK version v1.26+, LanceDB + embeddings architecture section, naming conventions filled in, Data Pipeline commands added, "100% coverage" claim removed |
| **.claude/mcp.json** | Replaced `npx mcp-proxy` command with direct `"url"` field — eliminates unnecessary proxy process |
| **ROADMAP.md** | Fixed transport (StreamableHTTP not SSE), port (4000 not 3001), endpoint (/mcp not /mcp/sse), marked config file issue as resolved, separated current vs planned tools |
| **GOTCHAS.md** | Replaced "config file doesn't work" with working `.claude/mcp.json` documentation |
| **CLOUDFLARE.md** | Replaced hardcoded tunnel name, credentials UUID, and hostname with `<PLACEHOLDER>` values |
| **README.md** | Updated config file note to mention `.claude/mcp.json` auto-configuration |

### Phase 3: Package Analysis

Identified outdated/deprecated packages (not upgraded — left for new repo):

| Package | Current | Latest | Issue |
|---|---|---|---|
| **@xenova/transformers** | 2.17.2 | 2.17.2 (EOL) | **Deprecated** — replaced by `@huggingface/transformers` v3. This is the embedding engine. Migration required. |
| **zod** | 3.25.76 | 4.3.6 | Major version. Must verify MCP SDK compatibility before upgrading. |
| **@lancedb/lancedb** | 0.22.3 | 0.26.2 | Semver `^0.22.3` caps at 0.22.x. Four minor versions with potential API changes. |
| **newrelic** | 13.6.6 | 13.12.0 | 6 minor versions behind. |
| **vitest** | 4.0.13 | 4.0.18 | Patch behind (safe update). |
| **supertest** | 7.1.4 | 7.2.2 | Minor behind (safe update). |
| **tsx** | 4.20.6 | 4.21.0 | Patch behind (safe update). |
| **typedoc** | 0.28.14 | 0.28.16 | Patch behind (safe update). |

---

## Commits Made This Session

```
2085393 Update CLAUDE.md and project docs to match actual codebase
ec368af Fix security vulnerabilities, bugs, and add comprehensive tests
```

Both pushed to `origin/claude/babylon-mcp-analysis-0uiq4`.

---

## Files Created This Session

| File | Purpose |
|---|---|
| `src/search/input-sanitizer.ts` | SQL injection & path traversal prevention |
| `src/search/input-sanitizer.test.ts` | 20 tests for the sanitizer |
| `src/mcp/handlers/shared/search-instance.test.ts` | 8 tests for singleton/race conditions |
| `ENHANCEMENT_IDEAS.md` | Parked tool ideas (Tier 1/2/3) and architecture notes |
| `SESSION_NOTES.md` | This file |

---

## Files Modified This Session

| File | Key Changes |
|---|---|
| `src/search/lancedb-search.ts` | All `.where()` calls use `buildWhereClause()`, `getSourceFile()` uses `resolveSecurePath()` |
| `src/mcp/handlers/shared/search-instance.ts` | Promise-based mutex, `resetSearchInstance()` export |
| `src/mcp/handlers/shared/error-handlers.ts` | Generic `withErrorHandling<T>`, `'text'` literal type |
| `src/mcp/handlers/docs/search-docs.handler.ts` | Zod bounds on query, category, limit |
| `src/mcp/handlers/docs/get-doc.handler.ts` | Zod bounds on path |
| `src/mcp/handlers/api/search-api.handler.ts` | Zod bounds on query, limit |
| `src/mcp/handlers/source/search-source.handler.ts` | Zod bounds on query, package, limit |
| `src/mcp/handlers/source/get-source.handler.ts` | Zod bounds, fixed double split('\n') |
| `src/mcp/handlers/editor/search-editor-docs.handler.ts` | Zod bounds, `any` → `SearchResult` |
| `src/mcp/server.ts` | 5-second shutdown timeout |
| `src/mcp/routes.ts` | `express.json({ limit: '1mb' })` |
| `src/mcp/transport.ts` | SDK type compatibility casts |
| `src/mcp/config.ts` | Version `'1.1.0'` → `'1.0.0'` |
| `src/mcp/handlers.test.ts` | Fully rewritten with mocks (50 tests) |
| `src/mcp/handlers/shared/error-handlers.test.ts` | Rewritten for new generic types |
| `src/mcp/handlers/editor/search-editor-docs.handler.test.ts` | Fixed type casts |
| `src/mcp/transport.test.ts` | Updated for sessionIdGenerator function |
| `src/search/document-parser.test.ts` | Rewritten with temp fixtures (hermetic) |
| `package.json` | Removed nodemon, ts-node |
| `tsconfig.json` | Removed importHelpers, ts-node block |
| `CLAUDE.md` | Full rewrite (see Phase 2) |
| `.claude/mcp.json` | `mcp-proxy` → direct `url` |
| `ROADMAP.md` | Fixed transport/endpoint/tools |
| `GOTCHAS.md` | Fixed config file section |
| `CLOUDFLARE.md` | Sanitized sensitive data |
| `README.md` | Updated config note |

---

## What Was NOT Done (Left for New Repo)

### Package Upgrades Needed
- `@xenova/transformers` → `@huggingface/transformers` v3 (deprecated package migration)
- `zod` v3 → v4 (verify MCP SDK compatibility first)
- `@lancedb/lancedb` 0.22 → 0.26 (check for API changes)
- Minor/patch updates for vitest, tsx, supertest, typedoc, newrelic

### Architecture Limitations Identified
- **All tools are search-only** — the codebase is tightly coupled to LanceDB vector search. Adding non-search tools (scene analysis, code generation) would require a service registry pattern.
- **No authentication/authorization** — open access, fine for local dev, not for production.
- **No WebSocket/SSE support** — needed for tools like `inspect_live_scene`.
- **No middleware/plugin architecture** — adding new tool categories requires modifying handler registration code.
- **Singleton search instance** — works for read-only search but won't scale to tools with different backends.

### Comparison with Context7
- Context7 provides broad documentation for many frameworks; this provides deep Babylon.js-specific knowledge (source code, API internals, Editor docs).
- If the goal is just docs search, Context7 is simpler and cheaper.
- If the goal is Babylon.js engine intelligence (scene analysis, migration, code generation), this has unique value Context7 can't provide.
- **Verdict**: the differentiator must be engine-specific tools beyond search.

### Enhancement Ideas (from ENHANCEMENT_IDEAS.md)

**Tier 1 — High Impact, Unique**:
- `analyze_babylon_scene` — parse .babylon/.glb, report hierarchy/materials/poly counts
- `generate_playground` — generate Playground URLs from code/descriptions
- `validate_babylon_scene` — detect missing textures, orphan nodes, broken refs
- `migrate_babylon_api` — identify deprecated APIs, suggest replacements

**Tier 2 — Medium Impact**:
- `configure_pbr_material` — generate PBR setup from descriptions
- `setup_havok_physics` — generate Havok config (shapes, bodies, constraints)
- `create_animation` — generate Animation/AnimationGroup code
- `build_node_material` — generate/modify Node Material Editor JSON
- `search_playground_examples` — search ~3000+ Playground examples
- `inspect_live_scene` — WebSocket connection to running Babylon.js app

**Tier 3 — Exploratory**:
- `optimize_scene_performance` — draw call reduction, LOD, instancing analysis
- `generate_shader` — GLSL/WGSL for ShaderMaterial
- `scaffold_project` — generate project structure with chosen features
- `explain_render_pipeline` — explain rendering pipeline step by step

### Previous Author's Roadmap (from ROADMAP.md)
The original roadmap has 8 phases. Phases 1-1.6 are mostly complete. Remaining planned phases:
- **Phase 2**: Playground examples integration (not started)
- **Phase 3**: Token optimization & caching (not started)
- **Phase 4**: Feedback collection system (not started)
- **Phase 5**: Learning & ranking optimization (not started)
- **Phase 6**: Feature requests & community engagement (not started)
- **Phase 7**: Multi-version support, code-aware search, performance (not started)
- **Phase 8**: Deployment, CI/CD, monitoring (not started)

These phases are oriented around search optimization and community features. The enhancement ideas above (Tier 1-3) represent a different, more tool-centric direction.

### Previous Author's Artifacts Worth Keeping
- `examples/audioEngine/` and `examples/scene/` — MCP vs non-MCP comparison docs showing concrete value (4x faster, 6x fewer tool calls, 2x more content). Useful for pitching the project.
- `ALPINE_SERVICE.md` — operational guide for Alpine Linux deployment.
- `GOTCHAS.md` — practical troubleshooting reference.
- `scripts/` — 16 utility scripts for indexing, testing, and setup.

---

## Current State Summary

- **Branch**: `claude/babylon-mcp-analysis-0uiq4` (pushed to origin)
- **Tests**: 14 files, 213 passing, 1 skipped, 0 failing
- **Typecheck**: Clean (0 errors)
- **Audit**: 0 vulnerabilities
- **Docs**: Fully synced with actual codebase
- **Packages**: Functional but several outdated/deprecated (see table above)

The repo is stable and well-documented as a reference implementation. For the new repo, the key decisions will be:
1. Keep search-only scope (compete with Context7) or go engine-intelligence (unique value)?
2. Which Tier 1 tools to build first?
3. Architecture for non-search tool backends (service registry, plugin system)?
4. Package migration strategy (@xenova → @huggingface, zod v4, lancedb 0.26)?
