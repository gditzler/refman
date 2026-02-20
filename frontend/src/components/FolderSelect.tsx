import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { useReferences } from "@/hooks/useReferences";
import { cn } from "@/lib/utils";

interface FolderSelectProps {
  value: string[];
  onChange: (folderNames: string[]) => void;
  placeholder?: string;
}

export function FolderSelect({
  value,
  onChange,
  placeholder = "Select or create folders...",
}: FolderSelectProps) {
  const { folders, createFolder } = useReferences();
  const [newFolderName, setNewFolderName] = useState("");

  const toggleFolder = (folderName: string) => {
    if (value.includes(folderName)) {
      onChange(value.filter((n) => n !== folderName));
    } else {
      onChange([...value, folderName]);
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await createFolder(name);
      if (!value.includes(name)) {
        onChange([...value, name]);
      }
      setNewFolderName("");
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((name) => (
          <Badge
            key={name}
            variant="secondary"
            className="flex items-center gap-1 pr-1"
          >
            {name}
            <button
              type="button"
              onClick={() => onChange(value.filter((n) => n !== name))}
              className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="rounded-md border p-2 max-h-40 overflow-y-auto space-y-1.5">
        {folders.map((folder) => (
          <label
            key={folder.id}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50"
            )}
          >
            <Checkbox
              checked={value.includes(folder.name)}
              onCheckedChange={() => toggleFolder(folder.name)}
            />
            <span className="text-sm">{folder.name}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreateFolder();
            }
          }}
          placeholder={placeholder}
          className="h-9 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCreateFolder}
          disabled={!newFolderName.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
