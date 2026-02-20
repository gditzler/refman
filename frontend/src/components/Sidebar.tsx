import { useEffect, useState } from "react";
import { Library, Folder, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReferences } from "@/hooks/useReferences";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

function getContrastColor(hexColor: string): string {
  if (!hexColor) return "#000000";
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

export function Sidebar() {
  const {
    tags,
    selectedTag,
    folders,
    selectedFolderId,
    fetchTags,
    fetchFolders,
    filterByTag,
    filterByFolder,
    createFolder,
    deleteFolder,
    addReferencesToFolder,
  } = useReferences();
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  useEffect(() => {
    fetchTags();
    fetchFolders();
  }, [fetchTags, fetchFolders]);

  const handleAllReferences = () => {
    filterByFolder(null);
  };

  const handleFolderClick = (folderId: string) => {
    if (selectedFolderId === folderId) {
      filterByFolder(null);
    } else {
      filterByFolder(folderId);
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await createFolder(name);
      setNewFolderName("");
      setShowNewFolderInput(false);
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  };

  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const handleFolderDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(null);
    try {
      const data = e.dataTransfer.getData("application/json");
      if (!data) return;
      const refIds: string[] = JSON.parse(data);
      if (refIds.length > 0) {
        await addReferencesToFolder(refIds, folderId);
        const folder = folders.find((f) => f.id === folderId);
        toast.success(
          refIds.length === 1
            ? `Added to ${folder?.name ?? "folder"}`
            : `Added ${refIds.length} references to ${folder?.name ?? "folder"}`
        );
      }
    } catch (err) {
      console.error("Failed to add references to folder:", err);
      toast.error("Failed to add references to folder");
    }
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverFolderId(folderId);
  };

  const handleFolderDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleDeleteFolder = async (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    if (window.confirm("Delete this folder? References will not be deleted.")) {
      try {
        await deleteFolder(folderId);
      } catch (err) {
        console.error("Failed to delete folder:", err);
      }
    }
  };

  const handleTagClick = (tagName: string) => {
    if (selectedTag === tagName) {
      filterByTag(null);
    } else {
      filterByTag(tagName);
    }
  };

  return (
    <aside className="h-full border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold">Antonelli</h1>
      </div>
      <ResizablePanelGroup orientation="vertical" className="flex-1">
        <ResizablePanel defaultSize={50} minSize={20}>
          <nav className="h-full p-2 overflow-y-auto">
            <SidebarItem
              icon={Library}
              label="All References"
              active={selectedTag === null && selectedFolderId === null}
              onClick={handleAllReferences}
            />
            <div className="mt-4">
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Folders
                </span>
                <button
                  type="button"
                  onClick={() => setShowNewFolderInput(true)}
                  className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  title="New folder"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {showNewFolderInput ? (
                <div className="p-2 flex gap-1">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateFolder();
                      if (e.key === "Escape") {
                        setShowNewFolderInput(false);
                        setNewFolderName("");
                      }
                    }}
                    placeholder="Folder name"
                    className="flex-1 px-2 py-1 text-sm rounded border bg-background"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowNewFolderInput(false);
                      setNewFolderName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}
              {folders.length > 0 ? (
                <div className="p-2 space-y-0.5">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleFolderClick(folder.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") handleFolderClick(folder.id);
                      }}
                      onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                      onDragLeave={handleFolderDragLeave}
                      onDrop={(e) => handleFolderDrop(e, folder.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors group",
                        selectedFolderId === folder.id
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
                        dragOverFolderId === folder.id && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      )}
                    >
                      <Folder className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 truncate">{folder.name}</span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteFolder(e, folder.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-opacity"
                        title="Delete folder"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                !showNewFolderInput && (
                  <div className="p-3 text-xs text-muted-foreground italic">
                    No folders yet. Click + to create one.
                  </div>
                )
              )}
            </div>
          </nav>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="h-full p-2 overflow-y-auto">
            <div className="px-1 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Tags
            </div>
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagClick(tag.name)}
                    className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                      "hover:ring-2 hover:ring-offset-1 hover:ring-offset-background",
                      selectedTag === tag.name && "ring-2 ring-offset-1 ring-offset-background"
                    )}
                    style={{
                      backgroundColor: tag.color || "#6b7280",
                      color: getContrastColor(tag.color || "#6b7280"),
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Add tags to your references to organize them
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </aside>
  );
}

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  indent?: boolean;
  onClick?: () => void;
}

function SidebarItem({ icon: Icon, label, active, indent, onClick }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
        indent && "ml-4",
        active
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

