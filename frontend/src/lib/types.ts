export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

export interface ReferenceLink {
  id: string;
  referenceId: string;
  label: string;
  url: string;
}

export interface Reference {
  id: string;
  entryType: string;
  citeKey: string;
  title: string;
  authors: string;
  year: number;
  venue: string;
  volume: string;
  number: string;
  pages: string;
  doi: string;
  url: string;
  abstract: string;
  keywords: string;
  notes: string;
  rawBibtex: string;
  githubUrl?: string;
  createdAt: string;
  updatedAt: string;
  importedAt?: string;
  tags: Tag[];
  folders?: Folder[];
  links?: ReferenceLink[];
}

export interface LinkInput {
  label: string;
  url: string;
}

export interface CreateReferenceInput {
  entryType: string;
  citeKey?: string;
  title: string;
  authors?: string;
  year?: number;
  venue?: string;
  volume?: string;
  number?: string;
  pages?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  keywords?: string;
  notes?: string;
  tags?: string[];
  folders?: string[];
  githubUrl?: string;
  links?: LinkInput[];
  fromImport?: boolean;
}

export interface UpdateReferenceInput {
  id: string;
  entryType: string;
  citeKey?: string;
  title: string;
  authors?: string;
  year?: number;
  venue?: string;
  volume?: string;
  number?: string;
  pages?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  keywords?: string;
  notes?: string;
  tags?: string[];
  folders?: string[];
  githubUrl?: string;
  links?: LinkInput[];
}

// Structured error returned by the Go backend via the Wails bridge.
// The Go AppError type JSON-encodes itself, so the JS error message is a JSON string.
export interface AppError {
  code: string;
  message: string;
  recoverable: boolean;
}

export const APP_ERROR_CODES = {
  CITE_KEY_COLLISION: "CITE_KEY_COLLISION",
  VALIDATION: "VALIDATION",
  NOT_FOUND: "NOT_FOUND",
  DATABASE: "DATABASE",
  IMPORT: "IMPORT",
} as const;

/**
 * Parse an unknown error thrown by a Wails bridge call into a human-readable message.
 * If the error is a structured AppError JSON string, use its message field.
 * Otherwise fall back to the raw error string.
 */
export function parseErrorMessage(err: unknown, fallback = "An unexpected error occurred"): string {
  const raw = err instanceof Error ? err.message : String(err ?? fallback);
  try {
    const parsed: AppError = JSON.parse(raw);
    if (parsed.message) return parsed.message;
  } catch {
    // Not a structured AppError — use raw message
  }
  return raw || fallback;
}

export type SearchMode = 'keyword' | 'ai';

export interface OllamaSettings {
  baseURL: string;
  model: string;
}

export const DEFAULT_OLLAMA_SETTINGS: OllamaSettings = {
  baseURL: 'http://localhost:11434',
  model: 'qwen:1.8b-chat-q4_0',
};

export const ENTRY_TYPES = [
  { value: "article", label: "Article" },
  { value: "book", label: "Book" },
  { value: "inproceedings", label: "Conference Paper" },
  { value: "incollection", label: "Book Chapter" },
  { value: "phdthesis", label: "PhD Thesis" },
  { value: "mastersthesis", label: "Master's Thesis" },
  { value: "techreport", label: "Technical Report" },
  { value: "misc", label: "Miscellaneous" },
] as const;
