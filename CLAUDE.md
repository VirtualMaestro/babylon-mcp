# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A TypeScript-based Node.js project using Express.js for building a Babylon MCP server. The project uses ES modules and modern TypeScript standards.

## Goals:
* Enable developers using babylonjs to quickly and easily search most current documentation for api documentation.
* Reduce token usage when using AI agents by having a canonical source for the framework and documentation.
* Enable developers to quickly and easily find sandbox examples
* Provide a mechanism to give feedback on how useful a particular result from the MCP server is for what they're trying to do
* Provide a mechanism to store feedback and use it to boost or lower probability of it being useful
* Provide a mechanism to collect feature enhancements or improvements and store them
* Provide a mechanism for users to see what other people have recommended and vote on the usefulness for them

## Sources of information:
* **Documentation** https://github.com/BabylonJS/Documentation.git
* **Babylon Source** https://github.com/BabylonJS/Babylon.js.git
* **Havok Physics** https://github.com/BabylonJS/havok.git
* **Editor** https://github.com/BabylonJS/Editor.git

## Roadmap Progress Tracking
When updating ROADMAP.md to track progress:
* Use `[X]` to mark completed tasks
* Use `[I]` to mark tasks currently in progress
* Use `[ ]` for tasks not yet started

This provides a clear visual indicator of project status.

## Development Commands

### Unified Server (MCP + Web Interface)
- `npm run dev` - Start server in development mode with hot reload (tsx watch)
- `npm run build` - Compile TypeScript to JavaScript in dist/
- `npm start` - Run compiled server from dist/

### Build & Testing
- `npm run typecheck` - Run TypeScript type checking without emitting files
- `npm run clean` - Remove the dist/ directory
- `npm test` - Run tests in watch mode
- `npm run test:run` - Run all tests once
- `npm run test:ui` - Run tests with interactive UI
- `npm run test:coverage` - Run tests with coverage report

### Data Pipeline
- `npm run clone:repos` - Clone Babylon.js repositories to data/repositories/
- `npm run index:docs` - Index documentation into LanceDB
- `npm run index:api` - Index API docs into LanceDB
- `npm run index:source` - Index source code into LanceDB
- `npm run index:all` - Run all three indexers sequentially

The server runs on **port 4000** by default and provides both MCP endpoints and web interface.

## Architecture

### Technology Stack
- **Runtime**: Node.js with ES modules
- **Language**: TypeScript 5.9+ with strict mode enabled
- **MCP Server**: @modelcontextprotocol/sdk v1.26+ (StreamableHTTPServerTransport)
- **Web Framework**: Express.js 5.x (integrated with MCP server)
- **Vector Database**: LanceDB v0.22+ for semantic search
- **Embeddings**: @xenova/transformers with Xenova/all-MiniLM-L6-v2 (local, 384 dimensions)
- **Build Tool**: TypeScript compiler (tsc)
- **Dev Tools**: tsx (TypeScript executor with watch mode)
- **Testing**: Vitest 4.x with v8 coverage provider
- **HTTP Testing**: supertest for Express route testing
- **Schema Validation**: Zod v3.25+ (compatible with MCP SDK)
- **APM**: New Relic (optional, via environment variables)

### TypeScript Configuration
- **Target**: ES2022 with NodeNext module resolution
- **Strict Mode**: All strict checks enabled including:
  - `noUnusedLocals`, `noUnusedParameters`
  - `noUncheckedIndexedAccess`
  - `exactOptionalPropertyTypes`
  - `noImplicitOverride`
- **Module System**: ES modules (`"type": "module"` in package.json)
- **Output**: Compiled files go to `dist/` with source maps and declaration files

### Project Structure
```
src/
  mcp/
    index.ts               - Main server entry point
    server.ts              - BabylonMCPServer class (MCP + Express integrated)
    config.ts              - Server configuration and metadata
    routes.ts              - Express route definitions (/, /health, /mcp)
    transport.ts           - HTTP transport layer for MCP requests
    repository-config.ts   - Git repository URLs and clone settings
    repository-manager.ts  - Clone/update logic for Babylon.js repos
    handlers/
      index.ts             - Registers all MCP tools on the server
      api/
        search-api.handler.ts          - search_babylon_api tool
      docs/
        search-docs.handler.ts         - search_babylon_docs tool
        get-doc.handler.ts             - get_babylon_doc tool
      editor/
        search-editor-docs.handler.ts  - search_babylon_editor_docs tool
      source/
        search-source.handler.ts       - search_babylon_source tool
        get-source.handler.ts          - get_babylon_source tool
      shared/
        error-handlers.ts              - Generic error-wrapping for handlers
        response-formatters.ts         - Shared response formatting utilities
        search-instance.ts             - Singleton LanceDBSearch factory
    *.test.ts              - Co-located unit tests for each module
  search/
    lancedb-search.ts      - Vector search queries against LanceDB
    lancedb-indexer.ts     - Indexes documentation into LanceDB tables
    api-indexer.ts         - Indexes TypeDoc API output
    source-code-indexer.ts - Indexes Babylon.js source files
    document-parser.ts     - Markdown + YAML frontmatter parser
    tsx-parser.ts          - TSX content extractor (TypeScript Compiler API)
    tsdoc-extractor.ts     - TypeDoc JSON extraction
    input-sanitizer.ts     - SQL injection & path traversal prevention
    types.ts               - Shared search type definitions
    *.test.ts              - Co-located unit tests
  __tests__/
    setup.ts               - Global test setup and teardown
    fixtures/              - Test fixtures (mock MCP requests, etc.)
  index.ts                 - Re-exports for library usage
scripts/
  clone-repos.ts           - Clone Babylon.js repositories
  index-docs.ts            - Index documentation into LanceDB
  index-api.ts             - Index API docs into LanceDB
  index-source.ts          - Index source code into LanceDB
  alpine-setup.sh          - Patch onnxruntime for Alpine/musl
dist/                      - Compiled JavaScript output (gitignored)
data/                      - Runtime data (gitignored)
  repositories/            - Cloned Babylon.js Git repos
  lancedb/                 - Vector database files
vitest.config.ts           - Vitest test configuration
```

### MCP Server Architecture

The MCP (Model Context Protocol) server is the primary interface for this application. It provides tools that AI agents can use to search and retrieve Babylon.js documentation, API references, and source code.

#### MCP Tools

- **search_babylon_docs**: Search Babylon.js documentation
  - Input: `query` (string), optional `category` (string), optional `limit` (number, 1-50)
  - Output: Ranked documentation results with snippets, categories, and relevance scores

- **get_babylon_doc**: Retrieve full documentation content
  - Input: `path` (string) - documentation file path or identifier
  - Output: Full documentation content optimized for AI consumption

- **search_babylon_api**: Search Babylon.js API documentation
  - Input: `query` (string), optional `limit` (number, 1-50)
  - Output: Ranked API results (classes, methods, properties) with TSDoc details

- **search_babylon_source**: Search Babylon.js source code
  - Input: `query` (string), optional `package` (string), optional `limit` (number, 1-50)
  - Output: Ranked source code results with file paths and snippets

- **get_babylon_source**: Retrieve specific source code file or line range
  - Input: `filePath` (string), optional `startLine` (number), optional `endLine` (number)
  - Output: Source code content with line numbers

- **search_babylon_editor_docs**: Search Babylon.js Editor documentation
  - Input: `query` (string), optional `category` (string), optional `limit` (number, 1-50)
  - Output: Ranked Editor documentation results

#### MCP Server Details
- **Transport**: HTTP with StreamableHTTPServerTransport (stateless mode)
- **Default Port**: 4000
- **Root Endpoint**: `http://localhost:4000/` (GET - server info)
- **MCP Endpoint**: `http://localhost:4000/mcp` (POST - JSON-RPC requests)
- **Health Check**: `http://localhost:4000/health` (GET request)
- **Server Name**: babylon-mcp
- **Version**: 1.0.0
- **Location**: `src/mcp/server.ts`
- **Configuration**: `src/mcp/config.ts`

The server is a unified Express + MCP application. It uses the official MCP SDK with StreamableHTTPServerTransport and implements the standard MCP protocol for tool listing and execution over HTTP POST requests with JSON-RPC.

### Search & Indexing Architecture

The search system uses **LanceDB** for vector storage and **@xenova/transformers** for local embeddings:

- **Embedding model**: Xenova/all-MiniLM-L6-v2 (384 dimensions, runs locally, no API costs)
- **Indexed sources**: Documentation (~745 files), API docs (~144 entries), Source code, Editor docs (~13 pages)
- **Search features**: Semantic vector similarity, category filtering, relevance scoring, snippet extraction
- **Security**: Input sanitization for LanceDB where clauses, path traversal prevention for source file access
- **Singleton pattern**: `search-instance.ts` uses a promise-based mutex to prevent race conditions during initialization

## Testing Strategy

### Test Framework: Vitest
We use Vitest for unit testing due to its:
- Native ES modules and TypeScript support
- Fast execution with native ESM support
- Compatible API with Jest for easy migration
- Built-in coverage via v8

### Test Organization
- **Co-located tests**: Each source file has a corresponding `.test.ts` file in the same directory
- **AAA Pattern**: Tests follow Arrange-Act-Assert structure
- **Comprehensive mocking**: All external dependencies (MCP SDK, Express, LanceDB, etc.) are properly mocked
- **Hermetic tests**: No tests depend on external data files or running services

### Coverage Targets
- **Lines**: 80% minimum
- **Functions**: 80% minimum
- **Branches**: 75% minimum
- **Statements**: 80% minimum

### Test Suites (14 files, 213 tests)

**MCP Server tests:**
1. **config.test.ts** (19 tests) - Server metadata, capabilities, transport config
2. **handlers.test.ts** (50 tests) - All 6 MCP tool registrations, Zod schema validation, response formats
3. **routes.test.ts** (13 tests) - Express middleware, endpoints, 404 handling
4. **transport.test.ts** (9 tests) - StreamableHTTPServerTransport lifecycle
5. **server.test.ts** (16 tests) - Server construction, startup, graceful shutdown, signal handling
6. **repository-manager.test.ts** (14 tests) - Clone, update, error handling

**Handler tests:**
7. **search-editor-docs.handler.test.ts** (8 tests) - Editor docs tool registration and search
8. **error-handlers.test.ts** (6 tests) - Error wrapping, formatting, passthrough
9. **response-formatters.test.ts** (11 tests) - Response formatting utilities

**Search tests:**
10. **search-instance.test.ts** (8 tests) - Singleton behavior, race condition prevention, reset
11. **lancedb-search.test.ts** (15 tests) - Vector search, category filtering, source retrieval
12. **document-parser.test.ts** (14 tests) - Markdown parsing, frontmatter extraction
13. **tsx-parser.test.ts** (11 tests) - TSX content extraction via TypeScript Compiler API
14. **input-sanitizer.test.ts** (20 tests) - SQL injection prevention, path traversal blocking

### Running Tests
```bash
npm test              # Watch mode for development
npm run test:run      # Run once (CI/CD)
npm run test:ui       # Interactive UI
npm run test:coverage # Generate coverage report
```

### Testing Best Practices
- Use TypeScript non-null assertions (`!`) in tests for cleaner code
- Mock external dependencies at module level
- Test both success and error paths
- Verify mock call counts and arguments
- Test edge cases (empty arrays, undefined values, errors)

## Coding Standards

### Naming Conventions
- Files: `kebab-case.ts` for modules, `kebab-case.handler.ts` for MCP tool handlers
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Types/interfaces: `PascalCase`

### General Guidance
* Prefer short methods and files.
  * Functions shorter than 20 lines
  * Files smaller than 100 lines
* Prefer using third party libraries if generated code is going to exceed size standards.
  * Prompt to search npmjs and the internet to see if there are libraries that might meet our needs.
  * Think deeply and advise on tradeoffs for libraries (including popularity, update frequency, and any security vulnerabilities)
  * Don't use libraries flagged as outdated or no longer maintained
  * Prefer libraries with fewer dependencies over those with many
* When selecting approaches, check documentation for deprecated code and research alternatives or new approaches.
- I'm ok with ! operator in test cases, but only use rarely in runtime code.
