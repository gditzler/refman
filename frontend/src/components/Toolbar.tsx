import { useState, useRef, useCallback, useEffect } from "react";
import { Plus, Download, Search, FileDown, FileText, Keyboard, Sparkles, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ReferenceForm } from "@/components/ReferenceForm";
import { ImportModal } from "@/components/ImportModal";
import { ImportDatabaseModal } from "@/components/ImportDatabaseModal";
import { ImportBibtexModal } from "@/components/ImportBibtexModal";
import { useReferences } from "@/hooks/useReferences";
import { toast } from "sonner";
import type { CreateReferenceInput, OllamaSettings } from "@/lib/types";
import { DEFAULT_OLLAMA_SETTINGS } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ChooseExportPath,
  ExportDatabaseToPath,
} from "../../wailsjs/go/main/App";

export function Toolbar() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImportDbOpen, setIsImportDbOpen] = useState(false);
  const [isImportBibtexOpen, setIsImportBibtexOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const [importedData, setImportedData] = useState<CreateReferenceInput | undefined>();
  const [searchValue, setSearchValue] = useState("");
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null);
  // Local state for editing settings in the dialog before saving
  const [draftSettings, setDraftSettings] = useState<OllamaSettings>(DEFAULT_OLLAMA_SETTINGS);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    searchReferences,
    ollamaSearchReferences,
    checkOllamaStatus,
    refreshReferences,
    exportAllToBibtex,
    exportSelectedToBibtex,
    saveBibtexToFile,
    copyToClipboard,
    selectedIds,
    searchMode,
    ollamaSettings,
    setSearchMode,
    setOllamaSettings,
  } = useReferences();

  // Check Ollama availability whenever settings change or mode switches to AI
  useEffect(() => {
    if (searchMode !== 'ai') return;
    setOllamaAvailable(null); // unknown while checking
    checkOllamaStatus(ollamaSettings.baseURL).then(setOllamaAvailable);
  }, [searchMode, ollamaSettings.baseURL, checkOllamaStatus]);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      if (value.trim() === "") {
        refreshReferences();
      } else if (searchMode === 'ai') {
        ollamaSearchReferences(value, ollamaSettings);
      } else {
        searchReferences(value);
      }
    }, 300);
  }, [refreshReferences, searchReferences, ollamaSearchReferences, searchMode, ollamaSettings]);

  const handleModeToggle = useCallback(() => {
    const next = searchMode === 'keyword' ? 'ai' : 'keyword';
    setSearchMode(next);
    // Clear search results and reset to current context
    setSearchValue("");
    refreshReferences();
  }, [searchMode, setSearchMode, refreshReferences]);

  const handleOpenAiSettings = () => {
    setDraftSettings(ollamaSettings);
    setIsAiSettingsOpen(true);
  };

  const handleSaveAiSettings = () => {
    setOllamaSettings(draftSettings);
    setIsAiSettingsOpen(false);
    // Recheck availability with new settings
    setOllamaAvailable(null);
    checkOllamaStatus(draftSettings.baseURL).then(setOllamaAvailable);
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (e.key === "Escape") {
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
          setSearchValue("");
          refreshReferences();
        }
        return;
      }

      if (inInput) return;

      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsFormOpen(true);
        return;
      }

      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsHelpOpen((v) => !v);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [refreshReferences]);

  const handleExportAll = async () => {
    try {
      const bibtex = await exportAllToBibtex();
      await saveBibtexToFile(bibtex);
      toast.success("References exported successfully");
    } catch (error) {
      toast.error("Failed to export references");
    }
  };

  const handleExportSelected = async () => {
    try {
      const bibtex = await exportSelectedToBibtex();
      await saveBibtexToFile(bibtex);
      toast.success("Selected references exported successfully");
    } catch (error) {
      toast.error("Failed to export references");
    }
  };

  const handleCopyAll = async () => {
    try {
      const bibtex = await exportAllToBibtex();
      await copyToClipboard(bibtex);
      toast.success("Copied all references to clipboard");
    } catch (error) {
      toast.error("Failed to copy references");
    }
  };

  const handleCopySelected = async () => {
    try {
      const bibtex = await exportSelectedToBibtex();
      await copyToClipboard(bibtex);
      toast.success("Copied selected references to clipboard");
    } catch (error) {
      toast.error("Failed to copy references");
    }
  };

  const handleImportSuccess = (data: CreateReferenceInput) => {
    setImportedData(data);
    setIsFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setImportedData(undefined);
    }
  };

  const handleExportDatabase = async () => {
    try {
      const filepath = await ChooseExportPath();
      if (filepath) {
        await new Promise((r) => setTimeout(r, 0));
        await ExportDatabaseToPath(filepath);
        toast.success("Database exported successfully");
      }
    } catch (err) {
      toast.error("Failed to export database");
    }
  };

  const isAiMode = searchMode === 'ai';

  // Availability dot color
  const dotColor =
    ollamaAvailable === null
      ? "bg-yellow-400"
      : ollamaAvailable
      ? "bg-green-500"
      : "bg-red-500";

  const dotTitle =
    ollamaAvailable === null
      ? "Checking Ollama..."
      : ollamaAvailable
      ? "Ollama is connected"
      : "Ollama is not reachable";

  return (
    <>
      <div className="flex items-center gap-4 p-4 border-b">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              File
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleExportDatabase}>
              Export Database
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsImportDbOpen(true)}>
              Import Database
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsImportBibtexOpen(true)}>
              Import from BibTeX
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Reference
        </Button>

        <Button variant="outline" onClick={() => setIsImportOpen(true)}>
          <FileDown className="h-4 w-4 mr-2" />
          Import
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleExportAll}>
              Export All to File
            </DropdownMenuItem>
            {selectedIds.length > 0 && (
              <DropdownMenuItem onClick={handleExportSelected}>
                Export Selected ({selectedIds.length}) to File
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleCopyAll}>
              Copy All to Clipboard
            </DropdownMenuItem>
            {selectedIds.length > 0 && (
              <DropdownMenuItem onClick={handleCopySelected}>
                Copy Selected ({selectedIds.length}) to Clipboard
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        {/* Search area */}
        <div className="flex items-center gap-1">
          {/* Mode toggle */}
          <Button
            variant={isAiMode ? "default" : "outline"}
            size="icon"
            title={isAiMode ? "Switch to keyword search" : "Switch to AI search (Ollama)"}
            onClick={handleModeToggle}
          >
            {isAiMode ? (
              <Sparkles className="h-4 w-4" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>

          {/* Search input */}
          <div className="relative w-64">
            {isAiMode ? (
              <Sparkles className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary" />
            ) : (
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            )}
            <Input
              id="global-search"
              ref={searchInputRef}
              placeholder={isAiMode ? "AI search... (/)" : "Search... (/)"}
              className="pl-9"
              value={searchValue}
              onChange={handleSearch}
            />
          </div>

          {/* Ollama availability dot + settings (AI mode only) */}
          {isAiMode && (
            <>
              <div
                className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`}
                title={dotTitle}
              />
              <Button
                variant="ghost"
                size="icon"
                title="Ollama settings"
                onClick={handleOpenAiSettings}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          title="Keyboard shortcuts (?)"
          onClick={() => setIsHelpOpen(true)}
        >
          <Keyboard className="h-4 w-4" />
          <span className="sr-only">Keyboard shortcuts</span>
        </Button>

        <ThemeToggle />
      </div>

      <ReferenceForm
        open={isFormOpen}
        onOpenChange={handleFormClose}
        mode="create"
        initialData={importedData}
      />

      <ImportModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImportSuccess={handleImportSuccess}
      />

      <ImportDatabaseModal
        open={isImportDbOpen}
        onOpenChange={setIsImportDbOpen}
      />

      <ImportBibtexModal
        open={isImportBibtexOpen}
        onOpenChange={setIsImportBibtexOpen}
      />

      {/* Keyboard shortcuts dialog */}
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 text-sm">
            <ShortcutRow keys={["/"]} description="Focus search" />
            <ShortcutRow keys={["n"]} description="New reference" />
            <ShortcutRow keys={["?"]} description="Toggle this help" />
            <ShortcutRow keys={["Esc"]} description="Clear search / close" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Ollama AI settings dialog */}
      <Dialog open={isAiSettingsOpen} onOpenChange={setIsAiSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Ollama AI Search Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ollama-url">Ollama URL</Label>
              <Input
                id="ollama-url"
                value={draftSettings.baseURL}
                onChange={(e) =>
                  setDraftSettings((s) => ({ ...s, baseURL: e.target.value }))
                }
                placeholder="http://localhost:11434"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ollama-model">Model</Label>
              <Input
                id="ollama-model"
                value={draftSettings.model}
                onChange={(e) =>
                  setDraftSettings((s) => ({ ...s, model: e.target.value }))
                }
                placeholder="qwen:1.8b-chat-q4_0"
              />
              <p className="text-xs text-muted-foreground">
                Any Ollama model that supports embeddings (e.g. nomic-embed-text, qwen2, llama3).
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAiSettingsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveAiSettings}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-muted-foreground">{description}</span>
      <div className="flex gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono min-w-[1.5rem]"
          >
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}
