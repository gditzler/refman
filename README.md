# Antonelli

A modern desktop reference manager for managing BibTeX references.

## Features

- Add, edit, and delete references manually
- Sortable table view with configurable columns
- BibTeX export (all references, selected, or single to clipboard)
- Light/dark theme toggle
- Auto-generated cite keys (e.g., Smith2024)

## Technology Stack

- **Backend**: Go with Wails v2
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Database**: SQLite (embedded)
- **UI Components**: shadcn/ui + TanStack Table

## Development

### Prerequisites

- Go 1.21+
- Node.js 18+
- Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

### Setup

```bash
# Install frontend dependencies
cd frontend && npm install && cd ..

# Run in development mode
wails dev

# Build for production
wails build
```

### Project Structure

```
antonelli/
├── main.go                 # Wails entry point
├── app.go                  # App struct with Wails bindings
├── app/
│   ├── database/           # SQLite connection & repository
│   ├── models/             # Reference data model
│   ├── reference/          # Service & validation
│   └── export/             # BibTeX export
├── frontend/
│   └── src/
│       ├── components/     # React components
│       ├── hooks/          # Custom hooks
│       ├── store/          # Zustand store
│       └── lib/            # Utilities & types
└── build/bin/              # Built application
```

## Usage

1. **Add Reference**: Click "Add Reference" button, fill in the form
2. **Edit Reference**: Click the three-dot menu on any row, select "Edit"
3. **Delete Reference**: Click the three-dot menu, select "Delete"
4. **Export BibTeX**: Click "Export" dropdown to save to file or copy to clipboard
5. **Search**: Use the search box to filter references
6. **Sort**: Click any column header to sort

## Database Location

- **macOS**: `~/Library/Application Support/antonelli/antonelli.db`

## Future Roadmap

- Folders and tags organization
- Auto-import (DOI, arXiv, ISBN, BibTeX files)
- Markdown notes with preview
- Additional themes (Nord, Nightfox)
- Google Drive backup/sync
- Linux and Windows builds

## License

MIT
