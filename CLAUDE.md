# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Antonelli** is a macOS desktop reference manager for BibTeX references, built with Go + Wails v2 (backend) and React + TypeScript + Vite + Tailwind CSS (frontend), using SQLite for storage.

## Commands

### Development

```bash
# Run in development mode (starts both Go backend and Vite dev server)
wails dev

# Build for production
wails build

# Install frontend dependencies (required after cloning)
cd frontend && npm install
```

### Testing

```bash
# Run all app-level Go tests (use this — go test ./... fails without a frontend build)
go test ./app/...

# Run a specific package or test
go test ./app/importer/ -run TestParseBibtex
go test ./app/ollama/... -v

# Frontend has no test setup; use the build to check TypeScript
cd frontend && npm run build
```

### Frontend only (without Wails)

```bash
cd frontend && npm run dev
```

## Architecture

### Wails Bridge Pattern

The core integration point is `app.go` — all public methods on the `App` struct are automatically bound to `window.go.main.App.*` in the frontend. The frontend calls these exclusively via `useReferences.ts` hook (no direct imports of Go types). This means:

- Adding a new backend feature = add method to `App` struct in `app.go` + declare it in the `Window.go` interface in `useReferences.ts`
- The bridge serializes errors as JSON strings; use `models.AppError` (not plain `error`) when you need structured error codes on the frontend

### Backend Layers

```
app.go               → Wails bindings (thin delegation layer)
app/reference/       → Business logic: CRUD, cite key generation, validation
app/database/        → SQLite repositories (repository.go, tag_repository.go,
                        folder_repository.go, link_repository.go, import_ops.go)
app/models/          → Shared data types (Reference, Tag, Folder, AppError)
app/importer/        → External API clients: arXiv, DOI (CrossRef), ISBN
app/importdb/        → Database-level import/export (JSON format + BibTeX file)
app/export/          → BibTeX and JSON serialization
app/ollama/          → Ollama HTTP client (client.go: GetEmbedding, IsAvailable,
                        StreamGenerate), CrossRef search (crossref.go: SearchCrossRef)
```

The Go module name is `antonelli` — use this in import paths (e.g. `antonelli/app/ollama`).

### Frontend Layers

```
App.tsx                    → Root layout: Sidebar + (Toolbar + ReferenceTable)
hooks/useReferences.ts     → All backend calls; single source of truth for data ops
store/referenceStore.ts    → Zustand store for UI state (references, selection, filters)
lib/types.ts               → TypeScript interfaces mirroring Go models + parseErrorMessage
components/                → React UI components
```

### State & Data Flow

1. `useReferenceStore` (Zustand) holds the current list of references, selected IDs, active tag/folder filter
2. `useReferences` hook wraps all backend calls and writes results into the store
3. **Always use `refreshReferences`** (not `fetchReferences`) after mutations — it respects the active folder/tag filter. `fetchReferences` always loads all references regardless of context.

### SQLite & Migrations

- DB file: `~/Library/Application Support/antonelli/antonelli.db`
- Migrations run on startup in `app/database/sqlite.go:migrate()`
- New columns: use `addColumnIfNotExists` (idempotent)
- One-time ops (e.g., FTS5 rebuild): use `runOnce(key, fn)` which tracks completion in the `schema_flags` table
- FTS5 full-text search is optional; falls back to LIKE queries if not compiled in. Enable with build tag `sqlite_fts5`

### Error Handling

Backend errors should use `models.NewAppError(code, message, recoverable)`. The `AppError.Error()` method marshals itself as JSON, which the Wails bridge passes as the error message string to the frontend. Use `parseErrorMessage()` in `lib/types.ts` to decode it.

### Wails Event Streaming (Go → Frontend)

For operations that stream data incrementally (e.g. Ollama token generation), use Wails events rather than a single return value:

```go
// Go: emit chunks during processing
runtime.EventsEmit(a.ctx, "ollama:chunk", tokenString)
runtime.EventsEmit(a.ctx, "ollama:refs", papersSlice)
runtime.EventsEmit(a.ctx, "ollama:error", errString)
```

```typescript
// Frontend: subscribe before triggering the call
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
const off = EventsOn("ollama:chunk", (chunk: string) => { ... });
// clean up: off() or EventsOff("ollama:chunk")
```

The Go method should return `void` (not `error`) when all outcomes are communicated via events — avoids dual error handling on the frontend.

### macOS Wails Dialog Gotcha

Native file dialogs must be separated from heavy work to avoid segfaults on macOS. Pattern used:
- `ChooseExportPath()` — shows save dialog, returns path
- `ExportDatabaseToPath(path)` — does the actual work

Never combine a `runtime.SaveFileDialog` / `runtime.OpenFileDialog` call with DB operations in the same method.
