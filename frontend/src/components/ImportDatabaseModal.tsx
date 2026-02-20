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
  ChooseImportFile,
  PreviewDatabaseImport,
  ImportDatabase,
} from "../../wailsjs/go/main/App";
import { useReferences } from "@/hooks/useReferences";
import { toast } from "sonner";

type ImportMode = "merge" | "replace";
type DuplicateStrategy = "autoSuffix" | "skip";

interface ImportDatabaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDatabaseModal({
  open,
  onOpenChange,
}: ImportDatabaseModalProps) {
  const { refreshReferences } = useReferences();
  const [filePath, setFilePath] = useState("");
  const [mode, setMode] = useState<ImportMode>("merge");
  const [duplicateStrategy, setDuplicateStrategy] =
    useState<DuplicateStrategy>("autoSuffix");
  const [duplicateKeys, setDuplicateKeys] = useState<string[]>([]);
  const [referenceCount, setReferenceCount] = useState(0);
  const [step, setStep] = useState<"choose" | "preview" | "importing">("choose");
  const [isLoading, setIsLoading] = useState(false);

  const handleChooseFile = async () => {
    try {
      const path = await ChooseImportFile();
      if (!path) return;
      setFilePath(path);
      setStep("preview");
      setDuplicateKeys([]);
      setReferenceCount(0);

      const preview = await PreviewDatabaseImport(path);
      setReferenceCount(preview.referenceCount);
      setDuplicateKeys(preview.duplicateCiteKeys || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load file");
    }
  };

  const handleImport = async () => {
    if (!filePath) return;
    if (mode === "replace" && !window.confirm("Replace will clear all current data. Continue?")) {
      return;
    }
    setIsLoading(true);
    try {
      const strategy = mode === "replace" ? "autoSuffix" : duplicateStrategy;
      const result = await ImportDatabase(filePath, mode, strategy);
      toast.success(
        `Imported ${result.imported} references${result.skipped > 0 ? `, skipped ${result.skipped} duplicates` : ""}`
      );
      refreshReferences();
      onOpenChange(false);
      reset();
    } catch (err) {
      console.error(err);
      toast.error("Failed to import database");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setFilePath("");
    setStep("choose");
    setMode("merge");
    setDuplicateStrategy("autoSuffix");
    setDuplicateKeys([]);
  };

  const hasDuplicates = duplicateKeys.length > 0;
  const canImport =
    step === "preview" &&
    (mode === "replace" || !hasDuplicates || duplicateStrategy);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Database</DialogTitle>
          <DialogDescription>
            Import references from an Antonelli JSON export file.
          </DialogDescription>
        </DialogHeader>

        {step === "choose" && (
          <div className="space-y-4 py-4">
            <Button onClick={handleChooseFile} variant="outline" className="w-full">
              Choose File...
            </Button>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground truncate" title={filePath}>
              {filePath.split("/").pop()}
            </div>
            <p className="text-sm">
              {referenceCount} references found.
            </p>

            <div className="space-y-2">
              <Label>Import mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as ImportMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merge">Merge (add to current database)</SelectItem>
                  <SelectItem value="replace">Replace (clear and import)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === "merge" && hasDuplicates && (
              <div className="space-y-2">
                <Label>Duplicate citation keys ({duplicateKeys.length})</Label>
                <p className="text-xs text-muted-foreground">
                  These keys already exist. Choose how to handle them:
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
