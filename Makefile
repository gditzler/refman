.PHONY: dev-build build dev

# sqlite_fts5 enables FTS5 full-text search in go-sqlite3 (opt-in, requires CGO).
# Without this tag the app falls back to LIKE-based search automatically.
BUILD_TAGS := sqlite_fts5

# dev-build: Install frontend deps and run wails dev (one-command development)
dev-build:
	./scripts/dev-build.sh

# build: Production build with FTS5
build:
	cd frontend && npm install && cd .. && wails build -tags "$(BUILD_TAGS)"

# dev: Run wails dev with FTS5
dev:
	wails dev -tags "$(BUILD_TAGS)"
