import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnSizingState,
} from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2, Copy, FolderOpen, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReferenceForm } from "@/components/ReferenceForm";
import { ReferenceDetail } from "@/components/ReferenceDetail";
import { Badge } from "@/components/ui/badge";
import { useReferences } from "@/hooks/useReferences";
import type { Reference } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Extracts the first author's last name for sorting.
 * Handles formats: "Last, First", "First Last", "First Middle Last", "Smith, John and Doe, Jane"
 */
function getFirstAuthorLastName(authors: string | null | undefined): string {
  if (!authors?.trim()) return "";
  const firstAuthor = authors.split(/\s+and\s+/i)[0]?.trim() || "";
  if (!firstAuthor) return "";
  // "Last, First" format - last name is before the comma
  if (firstAuthor.includes(", ")) {
    return firstAuthor.split(",")[0]?.trim() || "";
  }
  // "First Last" or "First Middle Last" - last name is the last word
  const parts = firstAuthor.split(/\s+/);
  return parts[parts.length - 1] || "";
}

export function ReferenceTable() {
  const {
    references,
    selectedIds,
    isLoading,
    folders,
    toggleSelected,
    selectAll,
    clearSelection,
    deleteReferenceWithUndo,
    exportToBibtex,
    exportSelectedToBibtex,
    saveBibtexToFile,
    copyToClipboard,
    addReferencesToFolder,
  } = useReferences();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [editingRef, setEditingRef] = useState<Reference | null>(null);
  const [selectedRef, setSelectedRef] = useState<Reference | null>(null);

  const handleDelete = (ref: Reference) => {
    deleteReferenceWithUndo(ref);
  };

  const handleCopyBibtex = async (id: string) => {
    try {
      const bibtex = await exportToBibtex(id);
      await copyToClipboard(bibtex);
      toast.success("BibTeX copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy BibTeX");
    }
  };

  const handleBulkDelete = () => {
    const toDelete = references.filter((r) => selectedIds.includes(r.id));
    clearSelection();
    toDelete.forEach((r) => deleteReferenceWithUndo(r));
  };

  const handleBulkExport = async () => {
    try {
      const bibtex = await exportSelectedToBibtex();
      await saveBibtexToFile(bibtex);
      toast.success(`Exported ${selectedIds.length} reference(s)`);
    } catch {
      toast.error("Failed to export selected references");
    }
  };

  const handleBulkAddToFolder = async (folderId: string) => {
    try {
      await addReferencesToFolder(selectedIds, folderId);
      const folder = folders.find((f) => f.id === folderId);
      toast.success(`Added ${selectedIds.length} reference(s) to "${folder?.name ?? "folder"}"`);
    } catch {
      toast.error("Failed to add references to folder");
    }
  };

  const columns = useMemo<ColumnDef<Reference>[]>(
    () => [
      {
        id: "select",
        size: 40,
        minSize: 40,
        maxSize: 40,
        enableResizing: false,
        header: ({ table }) => (
          <Checkbox
            checked={selectedIds.length === references.length && references.length > 0}
            onCheckedChange={(checked) => {
              if (checked) {
                selectAll();
              } else {
                clearSelection();
              }
            }}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.includes(row.original.id)}
            onCheckedChange={() => toggleSelected(row.original.id)}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "title",
        size: 250,
        minSize: 100,
        maxSize: 500,
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Title
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="truncate font-medium">
            {row.getValue("title")}
          </div>
        ),
      },
      {
        accessorKey: "authors",
        size: 180,
        minSize: 80,
        maxSize: 400,
        sortingFn: (rowA, rowB) => {
          const a = getFirstAuthorLastName(rowA.getValue("authors"));
          const b = getFirstAuthorLastName(rowB.getValue("authors"));
          return a.localeCompare(b, undefined, { sensitivity: "base" });
        },
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Authors
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="truncate">{row.getValue("authors")}</div>
        ),
      },
      {
        accessorKey: "year",
        size: 80,
        minSize: 60,
        maxSize: 100,
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Year
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => <div className="truncate">{row.getValue("year")}</div>,
      },
      {
        accessorKey: "venue",
        size: 150,
        minSize: 80,
        maxSize: 300,
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Venue
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="truncate">{row.getValue("venue")}</div>
        ),
      },
      {
        accessorKey: "citeKey",
        size: 120,
        minSize: 80,
        maxSize: 200,
        header: "Cite Key",
        cell: ({ row }) => (
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate block">
            {row.getValue("citeKey")}
          </code>
        ),
      },
      {
        accessorKey: "tags",
        size: 140,
        minSize: 80,
        maxSize: 250,
        header: "Tags",
        cell: ({ row }) => (
          <div className="flex gap-1 flex-wrap overflow-hidden max-h-12">
            {row.original.tags?.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="text-xs">
                {tag.name}
              </Badge>
            ))}
          </div>
        ),
        enableSorting: false,
      },
      {
        id: "actions",
        size: 48,
        minSize: 48,
        maxSize: 48,
        enableResizing: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingRef(row.original)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCopyBibtex(row.original.id)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy BibTeX
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => handleDelete(row.original)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [selectedIds, references, selectAll, clearSelection, toggleSelected]
  );

  const table = useReactTable({
    data: references,
    columns,
    state: { sorting, columnSizing },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (isLoading && references.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading references...
      </div>
    );
  }

  if (references.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-lg mb-2">No references yet</p>
        <p className="text-sm">Click "Add Reference" to get started</p>
      </div>
    );
  }

  return (
    <>
      {/* Bulk action bar — shown when rows are selected */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-md border bg-accent text-accent-foreground text-sm">
          <span className="font-medium">{selectedIds.length} selected</span>
          <div className="flex-1" />

          {folders.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FolderOpen className="h-4 w-4 mr-1" />
                  Add to Folder
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {folders.map((folder) => (
                  <DropdownMenuItem
                    key={folder.id}
                    onClick={() => handleBulkAddToFolder(folder.id)}
                  >
                    {folder.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button variant="outline" size="sm" onClick={handleBulkExport}>
            <Download className="h-4 w-4 mr-1" />
            Export BibTeX
          </Button>

          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleBulkDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>

          <Button variant="ghost" size="sm" onClick={clearSelection}>
            <X className="h-4 w-4" />
            <span className="sr-only">Clear selection</span>
          </Button>
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        <Table className="table-fixed w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="relative"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          "absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none",
                          "bg-border/50 hover:bg-primary/70 transition-colors",
                          header.column.getIsResizing() && "bg-primary"
                        )}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={selectedIds.includes(row.original.id) && "selected"}
                className="cursor-pointer"
                draggable
                onDragStart={(e) => {
                  const ids =
                    selectedIds.includes(row.original.id) && selectedIds.length > 0
                      ? selectedIds
                      : [row.original.id];
                  e.dataTransfer.setData("application/json", JSON.stringify(ids));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (
                    target.closest('[role="checkbox"]') ||
                    target.closest('[role="menuitem"]') ||
                    target.closest("button")
                  ) {
                    return;
                  }
                  setSelectedRef(row.original);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingRef && (
        <ReferenceForm
          open={!!editingRef}
          onOpenChange={(open) => !open && setEditingRef(null)}
          mode="edit"
          reference={editingRef}
        />
      )}

      {selectedRef && (
        <ReferenceDetail
          reference={selectedRef}
          open={!!selectedRef}
          onOpenChange={(open) => !open && setSelectedRef(null)}
          onEdit={() => {
            setEditingRef(selectedRef);
            setSelectedRef(null);
          }}
        />
      )}
    </>
  );
}
