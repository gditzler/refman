package main

import (
	"context"
	"fmt"
	"os"
	"sort"

	"antonelli/app/database"
	"antonelli/app/export"
	"antonelli/app/importdb"
	"antonelli/app/importer"
	"antonelli/app/models"
	"antonelli/app/ollama"
	"antonelli/app/reference"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx      context.Context
	db       *database.DB
	repo     *database.Repository
	service  *reference.Service
	importer *importer.Service
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	db, err := database.NewDB()
	if err != nil {
		runtime.LogErrorf(ctx, "Failed to initialize database: %v", err)
		return
	}
	a.db = db
	a.repo = database.NewRepository(db)
	a.service = reference.NewService(a.repo)
	a.importer = importer.NewService()

	runtime.LogInfo(ctx, "Database initialized successfully")
}

func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		a.db.Close()
	}
}

func (a *App) ready() error {
	if a.service == nil {
		return fmt.Errorf("database not initialized — check application logs for startup errors")
	}
	return nil
}

func (a *App) CreateReference(input models.CreateReferenceInput) (*models.Reference, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	return a.service.Create(input)
}

func (a *App) GetReference(id string) (*models.Reference, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	return a.service.GetByID(id)
}

func (a *App) GetAllReferences() ([]models.Reference, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	return a.service.GetAll()
}

func (a *App) UpdateReference(input models.UpdateReferenceInput) (*models.Reference, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	ref, err := a.service.Update(input)
	if err != nil {
		return nil, err
	}
	// Invalidate cached embedding — the content may have changed.
	_ = a.repo.DeleteEmbedding(input.ID)
	return ref, nil
}

func (a *App) DeleteReference(id string) error {
	if err := a.ready(); err != nil {
		return err
	}
	return a.service.Delete(id)
}

func (a *App) SearchReferences(query string) ([]models.Reference, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	return a.service.Search(query)
}

func (a *App) ExportToBibtex(id string) (string, error) {
	ref, err := a.service.GetByID(id)
	if err != nil {
		return "", err
	}
	return export.ToBibtex(*ref), nil
}

func (a *App) ExportAllToBibtex() (string, error) {
	refs, err := a.service.GetAll()
	if err != nil {
		return "", err
	}
	return export.ToBibtexMultiple(refs), nil
}

func (a *App) ExportSelectedToBibtex(ids []string) (string, error) {
	var refs []models.Reference
	for _, id := range ids {
		ref, err := a.service.GetByID(id)
		if err != nil {
			return "", err
		}
		refs = append(refs, *ref)
	}
	return export.ToBibtexMultiple(refs), nil
}

func (a *App) SaveBibtexToFile(content string) error {
	filepath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export BibTeX",
		DefaultFilename: "references.bib",
		Filters: []runtime.FileFilter{
			{DisplayName: "BibTeX Files", Pattern: "*.bib"},
		},
	})
	if err != nil {
		return err
	}
	if filepath == "" {
		return nil
	}

	return writeFile(filepath, content)
}

func (a *App) SaveTextToFile(content string, defaultFilename string) error {
	filepath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export Notes",
		DefaultFilename: defaultFilename,
		Filters: []runtime.FileFilter{
			{DisplayName: "Markdown Files", Pattern: "*.md"},
			{DisplayName: "Text Files", Pattern: "*.txt"},
			{DisplayName: "All Files", Pattern: "*"},
		},
	})
	if err != nil {
		return err
	}
	if filepath == "" {
		return nil
	}

	return writeFile(filepath, content)
}

func (a *App) GetEntryTypes() []string {
	return models.ValidEntryTypes
}

func (a *App) ImportFromArxiv(arxivID string) (*models.CreateReferenceInput, error) {
	return a.importer.ImportFromArxiv(arxivID)
}

func (a *App) ImportFromDOI(doi string) (*models.CreateReferenceInput, error) {
	return a.importer.ImportFromDOI(doi)
}

func (a *App) ImportFromISBN(isbn string) (*models.CreateReferenceInput, error) {
	return a.importer.ImportFromISBN(isbn)
}

func (a *App) GetAllTags() ([]models.Tag, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	return a.repo.GetAllTags()
}

func (a *App) GetReferencesByTag(tagName string) ([]models.Reference, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	return a.repo.GetReferencesByTag(tagName)
}

func (a *App) GetAllFolders() ([]models.Folder, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	return a.repo.GetAllFolders()
}

func (a *App) CreateFolder(name string) (*models.Folder, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	return a.repo.CreateFolder(name)
}

func (a *App) DeleteFolder(id string) error {
	if err := a.ready(); err != nil {
		return err
	}
	return a.repo.DeleteFolder(id)
}

func (a *App) GetReferencesByFolder(folderID string) ([]models.Reference, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	return a.repo.GetReferencesByFolder(folderID)
}

func (a *App) AddReferencesToFolder(refIDs []string, folderID string) error {
	if err := a.ready(); err != nil {
		return err
	}
	return a.repo.AddReferencesToFolder(refIDs, folderID)
}

// ChooseExportPath shows the save dialog and returns the selected path.
// Split from ExportDatabaseToPath to avoid macOS native dialog segfaults that
// can occur when dialogs and heavy DB work run in the same call stack.
func (a *App) ChooseExportPath() (string, error) {
	if a.ctx == nil {
		return "", fmt.Errorf("application not initialized")
	}
	filepath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export Database",
		DefaultFilename: "references.antonelli.json",
		// Only use *.json - Wails' macOS code crashes when UTType returns nil for
		// custom extensions like *.antonelli.json (insertObject:atIndex: object cannot be nil)
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files", Pattern: "*.json"},
		},
	})
	if err != nil {
		return "", err
	}
	return filepath, nil
}

// ExportDatabaseToPath exports the database to the given file path.
// Call ChooseExportPath first to get the path; using two separate calls
// avoids macOS native dialog segfaults.
func (a *App) ExportDatabaseToPath(filepath string) error {
	if a.repo == nil {
		return fmt.Errorf("application not initialized")
	}
	if filepath == "" {
		return nil // User cancelled
	}
	data, err := export.ToJSON(a.repo)
	if err != nil {
		return err
	}
	return writeFileBytes(filepath, data)
}

// ExportDatabaseToFile combines ChooseExportPath and ExportDatabaseToPath.
// Prefer the two-step flow (ChooseExportPath then ExportDatabaseToPath) if
// you encounter segfaults on macOS.
func (a *App) ExportDatabaseToFile() error {
	filepath, err := a.ChooseExportPath()
	if err != nil {
		return err
	}
	return a.ExportDatabaseToPath(filepath)
}

func (a *App) ChooseImportFile() (string, error) {
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Import Database",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files", Pattern: "*.json"},
		},
	})
}

func (a *App) ChooseBibtexFile() (string, error) {
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Import BibTeX",
		// Only use *.bib - Wails' macOS code crashes when UTType returns nil for
		// wildcard patterns like * (insertObject:atIndex: object cannot be nil)
		Filters: []runtime.FileFilter{
			{DisplayName: "BibTeX Files", Pattern: "*.bib"},
		},
	})
}

func (a *App) PreviewDatabaseImport(filePath string) (*importdb.PreviewResult, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	return importdb.Preview(data, a.repo)
}

func (a *App) ImportDatabase(filePath string, mode string, duplicateStrategy string) (*importdb.ImportResult, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	return importdb.Import(data, mode, duplicateStrategy, a.repo)
}

func (a *App) PreviewBibtexImport(filePath string) (*importdb.BibtexPreviewResult, error) {
	return importdb.PreviewBibtex(filePath, a.repo)
}

func (a *App) ImportBibtexFile(filePath string, duplicateStrategy string) (*importdb.ImportResult, error) {
	return importdb.ImportBibtex(filePath, duplicateStrategy, a.repo, a.service.Create)
}

// CheckOllamaStatus reports whether an Ollama instance is reachable at baseURL.
func (a *App) CheckOllamaStatus(baseURL string) bool {
	return ollama.NewClient(baseURL).IsAvailable()
}

type scoredRef struct {
	ref   models.Reference
	score float64
}

// OllamaSearchReferences performs semantic search using Ollama embeddings.
// It computes/caches embeddings for all references and returns the top matches
// for the query, sorted by cosine similarity (highest first).
func (a *App) OllamaSearchReferences(query, model, baseURL string) ([]models.Reference, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}

	allRefs, err := a.repo.GetAll()
	if err != nil {
		return nil, fmt.Errorf("get references: %w", err)
	}
	if len(allRefs) == 0 {
		return []models.Reference{}, nil
	}

	client := ollama.NewClient(baseURL)

	// Ensure embeddings exist for all references (lazy generation + caching).
	for _, ref := range allRefs {
		stored, err := a.repo.GetEmbedding(ref.ID)
		if err != nil {
			return nil, fmt.Errorf("get embedding for %s: %w", ref.ID, err)
		}
		// Re-embed if missing or model changed.
		if stored == nil || stored.Model != model {
			text := ollama.ReferenceText(ref.Title, ref.Authors, ref.Abstract, ref.Keywords, ref.Notes)
			emb, err := client.GetEmbedding(model, text)
			if err != nil {
				// Skip references we can't embed rather than aborting the whole search.
				continue
			}
			if err := a.repo.UpsertEmbedding(ref.ID, model, emb); err != nil {
				return nil, fmt.Errorf("store embedding for %s: %w", ref.ID, err)
			}
		}
	}

	// Embed the query.
	queryEmb, err := client.GetEmbedding(model, query)
	if err != nil {
		return nil, fmt.Errorf("embed query: %w", err)
	}

	// Load all stored embeddings and compute scores.
	stored, err := a.repo.GetAllEmbeddings()
	if err != nil {
		return nil, fmt.Errorf("load embeddings: %w", err)
	}

	var scored []scoredRef
	for _, ref := range allRefs {
		emb, ok := stored[ref.ID]
		if !ok {
			continue
		}
		score := ollama.CosineSimilarity(queryEmb, emb.Embedding)
		if score > 0.1 { // threshold: ignore very dissimilar results
			scored = append(scored, scoredRef{ref: ref, score: score})
		}
	}

	// Sort by score descending.
	sort.Slice(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})

	result := make([]models.Reference, len(scored))
	for i, s := range scored {
		result[i] = s.ref
	}
	return result, nil
}

// InvalidateEmbedding removes the cached embedding for a reference.
// Call this when a reference's content fields are updated.
func (a *App) InvalidateEmbedding(refID string) error {
	if err := a.ready(); err != nil {
		return err
	}
	return a.repo.DeleteEmbedding(refID)
}
