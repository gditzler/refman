import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { LinkInput } from "@/lib/types";

interface LinksFieldProps {
  githubUrl: string;
  links: LinkInput[];
  onGithubUrlChange: (url: string) => void;
  onLinksChange: (links: LinkInput[]) => void;
}

export function LinksField({
  githubUrl,
  links,
  onGithubUrlChange,
  onLinksChange,
}: LinksFieldProps) {
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const addLink = () => {
    const label = newLabel.trim();
    const url = newUrl.trim();
    if (!label || !url) return;
    onLinksChange([...links, { label, url }]);
    setNewLabel("");
    setNewUrl("");
  };

  const removeLink = (index: number) => {
    onLinksChange(links.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="githubUrl">GitHub Repository</Label>
        <Input
          id="githubUrl"
          type="url"
          value={githubUrl}
          onChange={(e) => onGithubUrlChange(e.target.value)}
          placeholder="https://github.com/owner/repo"
        />
      </div>

      <div className="space-y-2">
        <Label>Other Links</Label>
        <p className="text-xs text-muted-foreground">
          Project website, faculty page, etc.
        </p>
        {links.map((link, index) => (
          <div
            key={index}
            className="flex gap-2 items-center p-2 rounded-md border bg-muted/20"
          >
            <Input
              value={link.label}
              onChange={(e) => {
                const next = [...links];
                next[index] = { ...next[index], label: e.target.value };
                onLinksChange(next);
              }}
              placeholder="Label (e.g., Project site)"
              className="flex-1 min-w-0"
            />
            <Input
              type="url"
              value={link.url}
              onChange={(e) => {
                const next = [...links];
                next[index] = { ...next[index], url: e.target.value };
                onLinksChange(next);
              }}
              placeholder="https://..."
              className="flex-1 min-w-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeLink(index)}
              className="flex-shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label"
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && addLink()}
          />
          <Input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="URL"
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && addLink()}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={addLink}
            disabled={!newLabel.trim() || !newUrl.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
