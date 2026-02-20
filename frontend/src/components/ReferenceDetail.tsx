import { useState } from "react";
import { ExternalLink, Pencil, Download, Copy, Github } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { Reference } from "@/lib/types";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import { SaveTextToFile } from "../../wailsjs/go/main/App";
import { marked } from "marked";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ReferenceDetailProps {
  reference: Reference;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}

function getPaperUrl(reference: Reference): string | null {
  if (reference.url?.trim()) {
    return reference.url.trim();
  }
  if (reference.doi?.trim()) {
    const doi = reference.doi.trim().replace(/^https?:\/\/doi\.org\//i, "");
    return doi ? `https://doi.org/${doi}` : null;
  }
  return null;
}

export function ReferenceDetail({
  reference,
  open,
  onOpenChange,
  onEdit,
}: ReferenceDetailProps) {
  const [notesShowPreview, setNotesShowPreview] = useState(true);
  const paperUrl = getPaperUrl(reference);

  const handleOpenPaper = () => {
    if (paperUrl) {
      BrowserOpenURL(paperUrl);
    }
  };

  const handleExportNotes = async () => {
    if (!reference.notes) return;
    try {
      const filename = `${reference.citeKey || "notes"}-notes.md`;
      await SaveTextToFile(reference.notes, filename);
      toast.success("Notes exported");
    } catch (err) {
      toast.error("Failed to export notes");
    }
  };

  const handleCopyNotes = async () => {
    if (!reference.notes) return;
    try {
      await navigator.clipboard.writeText(reference.notes);
      toast.success("Notes copied to clipboard");
    } catch {
      toast.error("Failed to copy notes");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8">{reference.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Authors and Year */}
          <div className="text-sm text-muted-foreground">
            {reference.authors}
            {reference.year ? ` (${reference.year})` : ""}
          </div>

          {/* Venue */}
          {reference.venue && (
            <div className="text-sm italic">{reference.venue}</div>
          )}

          {/* Cite Key */}
          {reference.citeKey && (
            <div>
              <Label className="text-xs text-muted-foreground">Cite Key</Label>
              <code className="block text-sm bg-muted px-2 py-1 rounded mt-1">
                {reference.citeKey}
              </code>
            </div>
          )}

          {/* Imported / Added */}
          {(reference.importedAt || reference.createdAt) && (
            <div>
              <Label className="text-xs text-muted-foreground">
                {reference.importedAt ? "Imported" : "Added"}
              </Label>
              <p className="text-sm mt-1">
                {new Date(
                  reference.importedAt || reference.createdAt
                ).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          )}

          {/* Tags */}
          {reference.tags && reference.tags.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Tags</Label>
              <div className="flex gap-1 flex-wrap mt-1">
                {reference.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Abstract */}
          {reference.abstract && (
            <div>
              <Label className="text-xs text-muted-foreground">Abstract</Label>
              <p className="text-sm mt-1 leading-relaxed">{reference.abstract}</p>
            </div>
          )}

          {/* DOI */}
          {reference.doi && (
            <div>
              <Label className="text-xs text-muted-foreground">DOI</Label>
              <p className="text-sm mt-1">{reference.doi}</p>
            </div>
          )}

          {/* GitHub & Related Links */}
          {(reference.githubUrl || (reference.links && reference.links.length > 0)) && (
            <div>
              <Label className="text-xs text-muted-foreground">Related Links</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {reference.githubUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => BrowserOpenURL(reference.githubUrl!)}
                  >
                    <Github className="h-4 w-4 mr-2" />
                    GitHub
                  </Button>
                )}
                {reference.links?.map((link) => (
                  <Button
                    key={link.id}
                    variant="outline"
                    size="sm"
                    onClick={() => BrowserOpenURL(link.url)}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {link.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <div className="flex items-center gap-1">
                  <div className="flex rounded-md border border-input bg-muted/30 p-0.5">
                    <button
                      type="button"
                      onClick={() => setNotesShowPreview(false)}
                      className={cn(
                        "h-6 px-2 text-xs rounded transition-colors",
                        !notesShowPreview
                          ? "bg-background shadow-sm"
                          : "hover:bg-muted/50"
                      )}
                    >
                      Raw
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotesShowPreview(true)}
                      className={cn(
                        "h-6 px-2 text-xs rounded transition-colors",
                        notesShowPreview
                          ? "bg-background shadow-sm"
                          : "hover:bg-muted/50"
                      )}
                    >
                      Preview
                    </button>
                  </div>
                  {reference.notes && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={handleCopyNotes}
                        title="Copy markdown"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={handleExportNotes}
                        title="Export markdown"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="min-h-[60px] rounded-md border border-input bg-muted/20 px-3 py-2 text-sm prose prose-sm dark:prose-invert max-w-none">
                {reference.notes ? (
                  notesShowPreview ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: marked.parse(reference.notes, { async: false }) as string,
                      }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-mono text-xs mt-0">
                      {reference.notes}
                    </pre>
                  )
                ) : (
                  <p className="text-muted-foreground italic">No notes</p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}

          <div className="flex gap-2 pt-4 border-t">
            {paperUrl && (
              <Button onClick={handleOpenPaper} variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Paper
              </Button>
            )}
            <Button onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
