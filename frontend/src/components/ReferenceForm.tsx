import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReferences } from "@/hooks/useReferences";
import { ENTRY_TYPES, type Reference, type CreateReferenceInput, type UpdateReferenceInput } from "@/lib/types";
import { TagInput } from "@/components/TagInput";
import { FolderSelect } from "@/components/FolderSelect";
import { NotesField } from "@/components/NotesField";
import { LinksField } from "@/components/LinksField";
import { toast } from "sonner";

interface ReferenceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  reference?: Reference;
  initialData?: CreateReferenceInput;
}

const defaultFormData: CreateReferenceInput = {
  entryType: "article",
  title: "",
  authors: "",
  year: new Date().getFullYear(),
  venue: "",
  volume: "",
  number: "",
  pages: "",
  doi: "",
  url: "",
  abstract: "",
  keywords: "",
  notes: "",
  citeKey: "",
  tags: [],
  folders: [],
  githubUrl: "",
  links: [],
};

// Fields that are always shown for all entry types
// Secondary fields are hidden until "More fields" is expanded
const SECONDARY_FIELDS_BY_TYPE: Record<string, string[]> = {
  article:       ["volume", "number", "pages", "doi", "url", "abstract", "keywords"],
  book:          ["volume", "pages", "doi", "url", "abstract", "keywords"],
  inproceedings: ["pages", "doi", "url", "abstract", "keywords"],
  incollection:  ["volume", "number", "pages", "doi", "url", "abstract", "keywords"],
  phdthesis:     ["doi", "url", "abstract", "keywords"],
  mastersthesis: ["doi", "url", "abstract", "keywords"],
  techreport:    ["number", "pages", "doi", "url", "abstract", "keywords"],
  misc:          ["doi", "url", "abstract", "keywords"],
};

export function ReferenceForm({
  open,
  onOpenChange,
  mode,
  reference,
  initialData,
}: ReferenceFormProps) {
  const { createReference, editReference, refreshReferences, fetchTags, fetchFolders } = useReferences();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [formData, setFormData] = useState<CreateReferenceInput>(defaultFormData);

  useEffect(() => {
    if (mode === "edit" && reference) {
      setFormData({
        entryType: reference.entryType,
        title: reference.title,
        authors: reference.authors,
        year: reference.year,
        venue: reference.venue,
        volume: reference.volume,
        number: reference.number,
        pages: reference.pages,
        doi: reference.doi,
        url: reference.url,
        abstract: reference.abstract,
        keywords: reference.keywords,
        notes: reference.notes,
        citeKey: reference.citeKey,
        tags: reference.tags?.map((t) => t.name) || [],
        folders: reference.folders?.map((f) => f.name) || [],
        githubUrl: reference.githubUrl || "",
        links: reference.links?.map((l) => ({ label: l.label, url: l.url })) || [],
      });
      // Show more fields automatically in edit mode if any secondary field has data
      const secondary = SECONDARY_FIELDS_BY_TYPE[reference.entryType] ?? [];
      const hasSecondaryData = secondary.some((field) => {
        const val = (reference as unknown as Record<string, unknown>)[field];
        return val !== "" && val !== null && val !== undefined;
      });
      setShowMore(hasSecondaryData);
    } else if (initialData) {
      setFormData({ ...defaultFormData, ...initialData });
      setShowMore(true); // imported data may have many fields populated
    } else {
      setFormData(defaultFormData);
      setShowMore(false);
    }
  }, [mode, reference, initialData, open]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "year" ? parseInt(value) || 0 : value,
    }));
  };

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, entryType: value }));
  };

  const handleTagsChange = (tags: string[]) => {
    setFormData((prev) => ({ ...prev, tags }));
  };

  const handleFoldersChange = (folders: string[]) => {
    setFormData((prev) => ({ ...prev, folders }));
  };

  const handleGithubUrlChange = (githubUrl: string) => {
    setFormData((prev) => ({ ...prev, githubUrl }));
  };

  const handleLinksChange = (links: { label: string; url: string }[]) => {
    setFormData((prev) => ({ ...prev, links }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === "create") {
        await createReference({
          ...formData,
          fromImport: !!initialData,
        });
        toast.success("Reference created successfully");
      } else if (reference) {
        const updateData: UpdateReferenceInput = {
          id: reference.id,
          ...formData,
        };
        await editReference(updateData);
        toast.success("Reference updated successfully");
      }
      onOpenChange(false);
      refreshReferences();
      fetchTags();
      fetchFolders();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save reference"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const secondaryFields = SECONDARY_FIELDS_BY_TYPE[formData.entryType] ?? SECONDARY_FIELDS_BY_TYPE.misc;
  const showVolume = secondaryFields.includes("volume");
  const showNumber = secondaryFields.includes("number");
  const showPages = secondaryFields.includes("pages");
  const showDOI = secondaryFields.includes("doi");
  const showURL = secondaryFields.includes("url");
  const showAbstract = secondaryFields.includes("abstract");
  const showKeywords = secondaryFields.includes("keywords");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add New Reference" : "Edit Reference"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Fill in the details for the new reference."
              : "Update the reference details."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Core fields — always visible */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entryType">Entry Type *</Label>
              <Select value={formData.entryType} onValueChange={handleSelectChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ENTRY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="citeKey">Cite Key</Label>
              <Input
                id="citeKey"
                name="citeKey"
                value={formData.citeKey || ""}
                onChange={handleChange}
                placeholder="Auto-generated if empty"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authors">Authors</Label>
            <Input
              id="authors"
              name="authors"
              value={formData.authors || ""}
              onChange={handleChange}
              placeholder="e.g., Smith, John and Doe, Jane"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                name="year"
                type="number"
                value={formData.year || ""}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="venue">Venue / Journal / Publisher</Label>
              <Input
                id="venue"
                name="venue"
                value={formData.venue || ""}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagInput
              value={formData.tags || []}
              onChange={handleTagsChange}
              placeholder="Add tags..."
            />
          </div>

          <div className="space-y-2">
            <Label>Folders</Label>
            <FolderSelect
              value={formData.folders || []}
              onChange={handleFoldersChange}
              placeholder="Select or create folders..."
            />
          </div>

          {/* Secondary fields — collapsed by default */}
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full flex items-center justify-between text-muted-foreground hover:text-foreground -mx-1 px-1"
              onClick={() => setShowMore((v) => !v)}
            >
              <span>{showMore ? "Hide additional fields" : "Show additional fields"}</span>
              {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showMore && (
              <div className="space-y-4 mt-4">
                {(showVolume || showNumber || showPages) && (
                  <div className="grid grid-cols-3 gap-4">
                    {showVolume && (
                      <div className="space-y-2">
                        <Label htmlFor="volume">Volume</Label>
                        <Input
                          id="volume"
                          name="volume"
                          value={formData.volume || ""}
                          onChange={handleChange}
                        />
                      </div>
                    )}
                    {showNumber && (
                      <div className="space-y-2">
                        <Label htmlFor="number">Number</Label>
                        <Input
                          id="number"
                          name="number"
                          value={formData.number || ""}
                          onChange={handleChange}
                        />
                      </div>
                    )}
                    {showPages && (
                      <div className="space-y-2">
                        <Label htmlFor="pages">Pages</Label>
                        <Input
                          id="pages"
                          name="pages"
                          value={formData.pages || ""}
                          onChange={handleChange}
                          placeholder="e.g., 1-15"
                        />
                      </div>
                    )}
                  </div>
                )}

                {(showDOI || showURL) && (
                  <div className="grid grid-cols-2 gap-4">
                    {showDOI && (
                      <div className="space-y-2">
                        <Label htmlFor="doi">DOI</Label>
                        <Input
                          id="doi"
                          name="doi"
                          value={formData.doi || ""}
                          onChange={handleChange}
                          placeholder="10.1234/example"
                        />
                      </div>
                    )}
                    {showURL && (
                      <div className="space-y-2">
                        <Label htmlFor="url">URL</Label>
                        <Input
                          id="url"
                          name="url"
                          type="url"
                          value={formData.url || ""}
                          onChange={handleChange}
                        />
                      </div>
                    )}
                  </div>
                )}

                {showAbstract && (
                  <div className="space-y-2">
                    <Label htmlFor="abstract">Abstract</Label>
                    <textarea
                      id="abstract"
                      name="abstract"
                      value={formData.abstract || ""}
                      onChange={handleChange}
                      rows={3}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    />
                  </div>
                )}

                {showKeywords && (
                  <div className="space-y-2">
                    <Label htmlFor="keywords">Keywords</Label>
                    <Input
                      id="keywords"
                      name="keywords"
                      value={formData.keywords || ""}
                      onChange={handleChange}
                      placeholder="Comma-separated keywords"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Related Links</Label>
                  <LinksField
                    githubUrl={formData.githubUrl || ""}
                    links={formData.links || []}
                    onGithubUrlChange={handleGithubUrlChange}
                    onLinksChange={handleLinksChange}
                  />
                </div>
              </div>
            )}
          </div>

          <NotesField
            id="notes"
            value={formData.notes || ""}
            onChange={(value) => setFormData((prev) => ({ ...prev, notes: value }))}
            rows={4}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : mode === "create"
                ? "Add Reference"
                : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
