import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { marked } from "marked";
import { cn } from "@/lib/utils";

interface NotesFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  rows?: number;
  placeholder?: string;
}

export function NotesField({
  id,
  value,
  onChange,
  label = "Notes",
  rows = 4,
  placeholder = "Add notes in Markdown...",
}: NotesFieldProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex rounded-md border border-input bg-muted/30 p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs",
              !showPreview && "bg-background shadow-sm"
            )}
            onClick={() => setShowPreview(false)}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs",
              showPreview && "bg-background shadow-sm"
            )}
            onClick={() => setShowPreview(true)}
          >
            Preview
          </Button>
        </div>
      </div>
      {showPreview ? (
        <div className="min-h-[120px] rounded-md border border-input bg-muted/20 px-3 py-2 text-sm prose prose-sm dark:prose-invert max-w-none">
          {value ? (
            <div
              dangerouslySetInnerHTML={{
                __html: marked.parse(value, { async: false }) as string,
              }}
            />
          ) : (
            <p className="text-muted-foreground italic">No notes yet</p>
          )}
        </div>
      ) : (
        <Textarea
          id={id}
          name={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="font-mono text-sm"
        />
      )}
    </div>
  );
}
