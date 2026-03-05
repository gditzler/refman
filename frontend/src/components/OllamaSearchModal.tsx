import { useEffect, useRef, useState, useCallback } from "react";
import { Sparkles, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useReferences } from "@/hooks/useReferences";
import { ImportFromDOI } from "../../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import type { CrossRefPaper, CreateReferenceInput } from "@/lib/types";

interface OllamaSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onImportSuccess: (data: CreateReferenceInput) => void;
}

export function OllamaSearchModal({
  open,
  onOpenChange,
  query,
  onImportSuccess,
}: OllamaSearchModalProps) {
  const [text, setText] = useState("");
  const [papers, setPapers] = useState<CrossRefPaper[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [importingDOI, setImportingDOI] = useState<string | null>(null);
  const textRef = useRef<HTMLPreElement>(null);
  const { ollamaWebSearch, ollamaSettings } = useReferences();

  const reset = useCallback(() => {
    setText("");
    setPapers([]);
    setError(null);
    setIsStreaming(false);
    setImportingDOI(null);
  }, []);

  useEffect(() => {
    if (!open || !query.trim()) return;

    reset();
    setIsStreaming(true);

    const offChunk = EventsOn("ollama:chunk", (chunk: string) => {
      setText((prev) => prev + chunk);
    });

    const offRefs = EventsOn("ollama:refs", (refs: CrossRefPaper[]) => {
      setPapers(refs || []);
      setIsStreaming(false);
    });

    const offError = EventsOn("ollama:error", (msg: string) => {
      setError(msg);
      setIsStreaming(false);
    });

    ollamaWebSearch(query, ollamaSettings);

    return () => {
      offChunk();
      offRefs();
      offError();
      EventsOff("ollama:chunk", "ollama:refs", "ollama:error");
    };
  }, [open, query]);

  // Auto-scroll text area as content arrives
  useEffect(() => {
    if (textRef.current) {
      textRef.current.scrollTop = textRef.current.scrollHeight;
    }
  }, [text]);

  const handleImport = async (paper: CrossRefPaper) => {
    if (!paper.doi) return;
    setImportingDOI(paper.doi);
    try {
      const data = await ImportFromDOI(paper.doi);
      onImportSuccess(data);
    } catch {
      // If DOI lookup fails, fall back to a minimal pre-filled form
      onImportSuccess({
        entryType: "misc",
        title: paper.title,
        authors: paper.authors,
        year: paper.year,
        venue: paper.venue,
        doi: paper.doi,
      });
    } finally {
      setImportingDOI(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Search: {query}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Streaming text */}
          {(text || isStreaming) && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <pre
                ref={textRef}
                className="flex-1 overflow-y-auto whitespace-pre-wrap text-sm font-sans rounded-md bg-muted p-3 min-h-0"
              >
                {text}
                {isStreaming && (
                  <span className="inline-block w-2 h-4 bg-foreground animate-pulse ml-0.5 align-middle" />
                )}
              </pre>
            </div>
          )}

          {/* Loading state before text arrives */}
          {isStreaming && !text && !error && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching and summarizing...
            </div>
          )}

          {/* Reference cards */}
          {papers.length > 0 && (
            <div className="space-y-2 overflow-y-auto max-h-64 flex-shrink-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                References ({papers.length})
              </p>
              {papers.map((paper, i) => (
                <div
                  key={paper.doi || i}
                  className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium leading-snug truncate">[{i + 1}] {paper.title}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 truncate">
                      {paper.authors}{paper.year ? ` (${paper.year})` : ""}
                      {paper.venue ? ` · ${paper.venue}` : ""}
                    </p>
                    {paper.doi && (
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                        {paper.doi}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0"
                    disabled={!paper.doi || importingDOI === paper.doi}
                    onClick={() => handleImport(paper)}
                  >
                    {importingDOI === paper.doi ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3 w-3 mr-1" />
                    )}
                    Import
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
