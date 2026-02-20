import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ImportFromArxiv,
  ImportFromDOI,
  ImportFromISBN,
} from "../../wailsjs/go/main/App";
import type { CreateReferenceInput } from "@/lib/types";

type DetectedType = "arxiv" | "doi" | "isbn" | null;

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: (data: CreateReferenceInput) => void;
}

/** Auto-detect identifier type by pattern */
function detectType(value: string): DetectedType {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  // arXiv: digits/digits or "arxiv:" prefix or YYYY.NNNNN format
  if (/^(arxiv:)?\d{4}\.\d{4,5}(v\d+)?$/i.test(v)) return "arxiv";
  if (/^(arxiv:)?[a-z-]+\/\d{7}(v\d+)?$/i.test(v)) return "arxiv";
  // DOI: starts with 10. or doi: prefix
  if (/^(doi:)?10\.\d{4,}\/\S+/i.test(v)) return "doi";
  // ISBN: 10 or 13 digits (with optional hyphens)
  if (/^(\d[-\s]?){9}[\dxX]$/.test(v.replace(/[-\s]/g, "")) ||
      /^(\d[-\s]?){13}$/.test(v.replace(/[-\s]/g, ""))) return "isbn";
  return null;
}

const TYPE_LABELS: Record<NonNullable<DetectedType>, string> = {
  arxiv: "arXiv",
  doi: "DOI",
  isbn: "ISBN",
};

type Step = "input" | "review";

export function ImportModal({ open, onOpenChange, onImportSuccess }: ImportModalProps) {
  const [identifier, setIdentifier] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<Step>("input");
  const [fetchedData, setFetchedData] = useState<CreateReferenceInput | null>(null);

  const detectedType = detectType(identifier);

  const handleReset = () => {
    setStep("input");
    setFetchedData(null);
    setIdentifier("");
  };

  const handleClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      handleReset();
    }
  };

  const handleFetch = async () => {
    const trimmed = identifier.trim();
    if (!trimmed) {
      toast.error("Please enter an identifier");
      return;
    }
    const type = detectedType;
    if (!type) {
      toast.error("Could not detect identifier type. Paste a DOI (10.xxxx/...), arXiv ID (2301.07041), or ISBN.");
      return;
    }

    setIsLoading(true);
    try {
      let result: CreateReferenceInput;
      switch (type) {
        case "arxiv":
          result = await ImportFromArxiv(trimmed);
          break;
        case "doi":
          result = await ImportFromDOI(trimmed);
          break;
        case "isbn":
          result = await ImportFromISBN(trimmed);
          break;
      }
      setFetchedData(result);
      setStep("review");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("not found")) {
        toast.error("Reference not found. Check the identifier and try again.");
      } else if (msg.includes("invalid")) {
        toast.error("Invalid identifier format.");
      } else {
        toast.error("Failed to fetch metadata. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!fetchedData) return;
    onImportSuccess(fetchedData);
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Reference</DialogTitle>
          <DialogDescription>
            {step === "input"
              ? "Paste a DOI, arXiv ID, or ISBN — the type is detected automatically."
              : "Review the fetched metadata before adding to your library."}
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="identifier">Identifier</Label>
                  {detectedType && (
                    <Badge variant="secondary" className="text-xs">
                      Detected: {TYPE_LABELS[detectedType]}
                    </Badge>
                  )}
                </div>
                <Input
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g., 10.1038/nature12373 or 2301.07041 or 9780134685991"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLoading) {
                      e.preventDefault();
                      handleFetch();
                    }
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Supported: DOI (10.xxxx/...) · arXiv ID (YYYY.NNNNN or category/NNNNNNN) · ISBN (10 or 13 digits)
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleFetch} disabled={isLoading || !identifier.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  "Fetch Metadata"
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "review" && fetchedData && (
          <>
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>Metadata fetched successfully</span>
              </div>

              <div className="rounded-md border bg-muted/40 p-3 space-y-2 text-sm">
                <ReviewRow label="Type" value={fetchedData.entryType} />
                <ReviewRow label="Title" value={fetchedData.title} />
                {fetchedData.authors && <ReviewRow label="Authors" value={fetchedData.authors} />}
                {fetchedData.year && <ReviewRow label="Year" value={String(fetchedData.year)} />}
                {fetchedData.venue && <ReviewRow label="Venue" value={fetchedData.venue} />}
                {fetchedData.doi && <ReviewRow label="DOI" value={fetchedData.doi} />}
              </div>

              <p className="text-xs text-muted-foreground">
                Click "Add to Library" to open the full form where you can assign tags, folders, and notes.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={handleReset}>
                Back
              </Button>
              <Button onClick={handleConfirm}>
                Add to Library
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[60px] shrink-0">{label}</span>
      <span className="font-medium break-all">{value}</span>
    </div>
  );
}
