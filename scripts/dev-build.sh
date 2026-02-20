#!/usr/bin/env bash
# dev-build: Install frontend dependencies and run Wails in development mode.
# Usage: ./scripts/dev-build.sh   (from project root)
#    or: make dev-build          (if using Makefile)

set -e
cd "$(dirname "$0")/.."

echo "==> Installing frontend dependencies..."
cd frontend && npm install && cd ..

echo "==> Starting Wails dev server..."
wails dev -tags sqlite_fts5
