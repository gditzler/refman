import { useState, useRef, useCallback, useEffect } from "react";
import { Plus, Download, Search, FileDown, FileText, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ReferenceForm } from "@/components/ReferenceForm";
import { ImportModal } from "@/components/ImportModal";
import { ImportDatabaseModal } from "@/components/ImportDatabaseModal";
import { ImportBibtexModal } from "@/components/ImportBibtexModal";
import { useReferences } from "@/hooks/useReferences";
import { toast } from "sonner";
import type { CreateReferenceInput } from "@/lib/types";
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
  const [importedData, setImportedData] = useState<CreateReferenceInput | undefined>();
  const [searchValue, setSearchValue] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    searchReferences,
    fetchReferences,
    exportAllToBibtex,
    exportSelectedToBibtex,
    saveBibtexToFile,
    copyToClipboard,
    selectedIds,
  } = useReferences();

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      if (value.trim() === "") {
        fetchReferences();
      } else {
        searchReferences(value);
      }
    }, 300);
  }, [fetchReferences, searchReferences]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // Escape: blur search if focused, otherwise let dialogs handle it
      if (e.key === "Escape") {
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
          setSearchValue("");
          fetchReferences();
        }
        return;
      }

      // Don't intercept when user is typing in an input
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
  }, [fetchReferences]);

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
      // Two-step flow: dialog first, then export. Avoids macOS native dialog
      // segfaults that occur when both run in the same call stack.
      const filepath = await ChooseExportPath();
      if (filepath) {
        // Yield to event loop so dialog fully completes before heavy DB work
        await new Promise((r) => setTimeout(r, 0));
        await ExportDatabaseToPath(filepath);
        toast.success("Database exported successfully");
      }
    } catch (err) {
      toast.error("Failed to export database");
    }
  };

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

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="global-search"
            ref={searchInputRef}
            placeholder="Search... (/)"
            className="pl-9"
            value={searchValue}
            onChange={handleSearch}
          />
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
