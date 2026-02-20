# Building Antonelli

This document provides instructions for building and running Antonelli from source.

## Prerequisites

### macOS

1. **Go 1.21+**
   ```bash
   brew install go
   ```

2. **Node.js 18+**
   ```bash
   brew install node
   ```

3. **Wails CLI**
   ```bash
   go install github.com/wailsapp/wails/v2/cmd/wails@latest
   ```

4. **Xcode Command Line Tools** (for CGO/SQLite)
   ```bash
   xcode-select --install
   ```

### Linux (Ubuntu/Debian)

1. **Go 1.21+**
   ```bash
   sudo apt update
   sudo apt install golang-go
   ```

2. **Node.js 18+**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

3. **Build dependencies**
   ```bash
   sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev gcc
   ```

4. **Wails CLI**
   ```bash
   go install github.com/wailsapp/wails/v2/cmd/wails@latest
   ```

### Windows

1. **Go 1.21+**: Download from https://go.dev/dl/

2. **Node.js 18+**: Download from https://nodejs.org/

3. **WebView2**: Usually pre-installed on Windows 10/11. If not, download from Microsoft.

4. **Wails CLI**
   ```powershell
   go install github.com/wailsapp/wails/v2/cmd/wails@latest
   ```

## Verify Installation

Run the Wails doctor to check your environment:

```bash
wails doctor
```

This will identify any missing dependencies.

## Building

### Clone and Setup

```bash
git clone <repository-url>
cd antonelli

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Development Mode

**One-command dev (recommended):** Install frontend deps and run with hot reload:

```bash
make dev-build
# or: ./scripts/dev-build.sh
```

**Or manually:**

```bash
wails dev
```

This will:
- Start the Go backend
- Start the Vite dev server for the frontend
- Open the application window
- Enable hot reload for frontend changes

### Production Build

Build a production binary:

```bash
wails build
```

The built application will be in:
- **macOS**: `build/bin/antonelli.app`
- **Linux**: `build/bin/antonelli`
- **Windows**: `build/bin/antonelli.exe`

### Build Options

```bash
# Build with debug info
wails build -debug

# Build without packaging (raw binary)
wails build -skipbindings

# Cross-compile (requires appropriate toolchain)
wails build -platform darwin/amd64
wails build -platform linux/amd64
wails build -platform windows/amd64
```

## Running

### macOS

```bash
# From build directory
open build/bin/antonelli.app

# Or run directly
./build/bin/antonelli.app/Contents/MacOS/antonelli
```

### Linux

```bash
./build/bin/antonelli
```

### Windows

```powershell
.\build\bin\antonelli.exe
```

## Database Location

Antonelli stores its SQLite database in your user data directory:

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Application Support/antonelli/antonelli.db` |
| Linux | `~/.local/share/antonelli/antonelli.db` |
| Windows | `%APPDATA%\antonelli\antonelli.db` |

## Troubleshooting

### CGO Errors on macOS

If you see CGO-related errors, ensure Xcode Command Line Tools are installed:

```bash
xcode-select --install
```

### WebKit Errors on Linux

Install the required WebKit development libraries:

```bash
sudo apt install libwebkit2gtk-4.0-dev
```

### Wails Not Found

Ensure `$GOPATH/bin` is in your PATH:

```bash
export PATH="$PATH:$(go env GOPATH)/bin"
```

Add this to your shell profile (`.bashrc`, `.zshrc`, etc.) to make it permanent.

### Frontend Build Fails

Clear node_modules and reinstall:

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
cd ..
```

## Development

### Project Structure

```
antonelli/
├── main.go                 # Wails entry point
├── app.go                  # App struct with bindings
├── app/
│   ├── database/           # SQLite connection & queries
│   ├── models/             # Data structures
│   ├── reference/          # Business logic
│   └── export/             # BibTeX export
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── store/          # Zustand state
│   │   └── lib/            # Utilities
│   └── package.json
└── build/                  # Build output
```

### Making Changes

1. **Backend changes**: Modify Go files, then restart `wails dev`
2. **Frontend changes**: Modify React files, hot reload handles it automatically
3. **Adding Wails bindings**: Update `app.go`, run `wails generate module`

### Running Tests

```bash
# Go tests
go test ./...

# Frontend tests (if configured)
cd frontend && npm test
```
