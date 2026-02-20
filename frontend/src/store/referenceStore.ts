import { create } from "zustand";
import type { Reference, Tag, Folder } from "@/lib/types";

interface ReferenceState {
  references: Reference[];
  selectedIds: string[];
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  tags: Tag[];
  selectedTag: string | null;
  folders: Folder[];
  selectedFolderId: string | null;

  setReferences: (references: Reference[]) => void;
  addReference: (reference: Reference) => void;
  updateReference: (reference: Reference) => void;
  removeReference: (id: string) => void;

  setSelectedIds: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTags: (tags: Tag[]) => void;
  setSelectedTag: (tag: string | null) => void;
  setFolders: (folders: Folder[]) => void;
  setSelectedFolderId: (folderId: string | null) => void;
}

export const useReferenceStore = create<ReferenceState>((set, get) => ({
  references: [],
  selectedIds: [],
  searchQuery: "",
  isLoading: false,
  error: null,
  tags: [],
  selectedTag: null,
  folders: [],
  selectedFolderId: null,

  setReferences: (references) => set({ references }),

  addReference: (reference) =>
    set((state) => ({
      references: [reference, ...state.references],
    })),

  updateReference: (reference) =>
    set((state) => ({
      references: state.references.map((r) =>
        r.id === reference.id ? reference : r
      ),
    })),

  removeReference: (id) =>
    set((state) => ({
      references: state.references.filter((r) => r.id !== id),
      selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
    })),

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  toggleSelected: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((selectedId) => selectedId !== id)
        : [...state.selectedIds, id],
    })),

  selectAll: () =>
    set((state) => ({
      selectedIds: state.references.map((r) => r.id),
    })),

  clearSelection: () => set({ selectedIds: [] }),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setTags: (tags) => set({ tags }),
  setSelectedTag: (tag) => set({ selectedTag: tag }),
  setFolders: (folders) => set({ folders }),
  setSelectedFolderId: (folderId) => set({ selectedFolderId: folderId }),
}));
