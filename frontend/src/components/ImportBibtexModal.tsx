import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChooseBibtexFile,
  PreviewBibtexImport,
  ImportBibtexFile,
} from "../../wailsjs/go/main/App";
import { useReferences } from "@/hooks/useReferences";
import { toast } from "sonner";

type DuplicateStrategy = "autoSuffix" | "skip";

interface ImportBibtexModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportBibtexModal({
  open,
  onOpenChange,
}: ImportBibtexModalProps) {
  const { fetchReferences } = useReferences();
  const [filePath, setFilePath] = useState("");
  const [duplicateStrategy, setDuplicateStrategy] =
    useState<DuplicateStrategy>("autoSuffix");
  const [duplicateKeys, setDuplicateKeys] = useState<string[]>([]);
  const [refCount, setRefCount] = useState(0);
  const [step, setStep] = useState<"choose" | "preview" | "importing">("choose");
  const [isLoading, setIsLoading] = useState(false);

  const handleChooseFile = async () => {
    try {
      const path = await ChooseBibtexFile();
      if (!path) return;
      setFilePath(path);
      setStep("preview");
      setDuplicateKeys([]);
      setRefCount(0);

      const preview = await PreviewBibtexImport(path);
      setRefCount(preview.refs?.length ?? 0);
      setDuplicateKeys(preview.duplicateCiteKeys || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load file");
    }
  };

  const handleImport = async () => {
    if (!filePath) return;
    setIsLoading(true);
    try {
      const result = await ImportBibtexFile(filePath, duplicateStrategy);
      toast.success(
        `Imported ${result.imported} references${result.skipped > 0 ? `, skipped ${result.skipped} duplicates` : ""}`
      );
      fetchReferences();
      onOpenChange(false);
      reset();
    } catch (err) {
      console.error(err);
      toast.error("Failed to import BibTeX");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setFilePath("");
    setStep("choose");
    setDuplicateStrategy("autoSuffix");
    setDuplicateKeys([]);
  };

  const hasDuplicates = duplicateKeys.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import from BibTeX</DialogTitle>
          <DialogDescription>
            Import references from a .bib file.
          </DialogDescription>
        </DialogHeader>

        {step === "choose" && (
          <div className="space-y-4 py-4">
            <Button onClick={handleChooseFile} variant="outline" className="w-full">
              Choose .bib File...
            </Button>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground truncate" title={filePath}>
              {filePath.split("/").pop()}
            </div>
            <p className="text-sm">{refCount} references found.</p>

            {hasDuplicates && (
              <div className="space-y-2">
                <Label>Duplicate citation keys ({duplicateKeys.length})</Label>
                <p className="text-xs text-muted-foreground">
                  Choose how to handle them:
                </p>
                <Select
                  value={duplicateStrategy}
                  onValueChange={(v) => setDuplicateStrategy(v as DuplicateStrategy)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="autoSuffix">
                      Auto-suffix (e.g. Smith2024 → Smith2024a)
                    </SelectItem>
                    <SelectItem value="skip">Skip duplicates</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground max-h-20 overflow-y-auto">
                  {duplicateKeys.join(", ")}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("choose")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={isLoading}>
                {isLoading ? "Importing..." : "Import"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
