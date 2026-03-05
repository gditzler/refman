import { useCallback, useRef } from "react";
import { useReferenceStore } from "@/store/referenceStore";
import { toast } from "sonner";
import { parseErrorMessage } from "@/lib/types";
import type { CreateReferenceInput, UpdateReferenceInput, Reference, OllamaSettings } from "@/lib/types";

declare global {
  interface Window {
    go: {
      main: {
        App: {
          GetAllReferences: () => Promise<any[]>;
          GetReference: (id: string) => Promise<any>;
          CreateReference: (input: CreateReferenceInput) => Promise<any>;
          UpdateReference: (input: UpdateReferenceInput) => Promise<any>;
          DeleteReference: (id: string) => Promise<void>;
          SearchReferences: (query: string) => Promise<any[]>;
          ExportToBibtex: (id: string) => Promise<string>;
          ExportAllToBibtex: () => Promise<string>;
          ExportSelectedToBibtex: (ids: string[]) => Promise<string>;
          SaveBibtexToFile: (content: string) => Promise<void>;
          GetEntryTypes: () => Promise<string[]>;
          GetAllTags: () => Promise<any[]>;
          GetReferencesByTag: (tagName: string) => Promise<any[]>;
          GetAllFolders: () => Promise<any[]>;
          CreateFolder: (name: string) => Promise<any>;
          DeleteFolder: (id: string) => Promise<void>;
          GetReferencesByFolder: (folderID: string) => Promise<any[]>;
          AddReferencesToFolder: (refIDs: string[], folderID: string) => Promise<void>;
          OllamaSearchReferences: (query: string, model: string, baseURL: string) => Promise<any[]>;
          CheckOllamaStatus: (baseURL: string) => Promise<boolean>;
          InvalidateEmbedding: (refID: string) => Promise<void>;
        };
      };
    };
  }
}

export function useReferences() {
  const {
    references,
    selectedIds,
    searchQuery,
    isLoading,
    error,
    tags,
    selectedTag,
    folders,
    selectedFolderId,
    searchMode,
    ollamaSettings,
    setReferences,
    addReference,
    updateReference,
    removeReference,
    setSelectedIds,
    toggleSelected,
    selectAll,
    clearSelection,
    setSearchQuery,
    setLoading,
    setError,
    setTags,
    setSelectedTag,
    setFolders,
    setSelectedFolderId,
    setSearchMode,
    setOllamaSettings,
  } = useReferenceStore();

  // Map of pending deletes: id → { ref snapshot, timeout handle }
  const pendingDeletes = useRef<Map<string, { ref: Reference; timer: ReturnType<typeof setTimeout> }>>(new Map());

  const fetchReferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const refs = await window.go.main.App.GetAllReferences();
      setReferences(refs || []);
    } catch (err) {
      setError(parseErrorMessage(err, "Failed to fetch references"));
    } finally {
      setLoading(false);
    }
  }, [setReferences, setLoading, setError]);

  const refreshReferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (selectedFolderId) {
        const refs = await window.go.main.App.GetReferencesByFolder(selectedFolderId);
        setReferences(refs || []);
      } else if (selectedTag) {
        const refs = await window.go.main.App.GetReferencesByTag(selectedTag);
        setReferences(refs || []);
      } else {
        const refs = await window.go.main.App.GetAllReferences();
        setReferences(refs || []);
      }
    } catch (err) {
      setError(parseErrorMessage(err, "Failed to fetch references"));
    } finally {
      setLoading(false);
    }
  }, [setReferences, setLoading, setError, selectedFolderId, selectedTag]);

  const searchReferences = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      setLoading(true);
      setError(null);
      try {
        const refs = await window.go.main.App.SearchReferences(query);
        setReferences(refs || []);
      } catch (err) {
        setError(parseErrorMessage(err, "Failed to search references"));
      } finally {
        setLoading(false);
      }
    },
    [setReferences, setSearchQuery, setLoading, setError]
  );

  const ollamaSearchReferences = useCallback(
    async (query: string, settings: OllamaSettings) => {
      setSearchQuery(query);
      setLoading(true);
      setError(null);
      try {
        const refs = await window.go.main.App.OllamaSearchReferences(
          query,
          settings.model,
          settings.baseURL
        );
        setReferences(refs || []);
      } catch (err) {
        setError(parseErrorMessage(err, "AI search failed"));
      } finally {
        setLoading(false);
      }
    },
    [setReferences, setSearchQuery, setLoading, setError]
  );

  const checkOllamaStatus = useCallback(async (baseURL: string): Promise<boolean> => {
    try {
      return await window.go.main.App.CheckOllamaStatus(baseURL);
    } catch {
      return false;
    }
  }, []);

  const createReference = useCallback(
    async (input: CreateReferenceInput) => {
      setLoading(true);
      setError(null);
      try {
        const ref = await window.go.main.App.CreateReference(input);
        addReference(ref);
        return ref;
      } catch (err) {
        const message = parseErrorMessage(err, "Failed to create reference");
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [addReference, setLoading, setError]
  );

  const editReference = useCallback(
    async (input: UpdateReferenceInput) => {
      setLoading(true);
      setError(null);
      try {
        const ref = await window.go.main.App.UpdateReference(input);
        updateReference(ref);
        return ref;
      } catch (err) {
        const message = parseErrorMessage(err, "Failed to update reference");
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [updateReference, setLoading, setError]
  );

  const deleteReference = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        await window.go.main.App.DeleteReference(id);
        removeReference(id);
      } catch (err) {
        const message = parseErrorMessage(err, "Failed to delete reference");
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [removeReference, setLoading, setError]
  );

  const deleteReferenceWithUndo = useCallback(
    (ref: Reference) => {
      // Cancel any existing pending delete for this id (shouldn't happen, but be safe)
      const existing = pendingDeletes.current.get(ref.id);
      if (existing) {
        clearTimeout(existing.timer);
        pendingDeletes.current.delete(ref.id);
      }

      // Optimistically remove from UI
      removeReference(ref.id);

      // Schedule actual deletion after 5 seconds
      const timer = setTimeout(async () => {
        pendingDeletes.current.delete(ref.id);
        try {
          await window.go.main.App.DeleteReference(ref.id);
        } catch {
          // If actual delete fails, restore the reference
          addReference(ref);
          toast.error("Failed to delete reference");
        }
      }, 5000);

      pendingDeletes.current.set(ref.id, { ref, timer });

      // Show undo toast
      toast("Reference deleted", {
        action: {
          label: "Undo",
          onClick: () => {
            const pending = pendingDeletes.current.get(ref.id);
            if (pending) {
              clearTimeout(pending.timer);
              pendingDeletes.current.delete(ref.id);
              addReference(ref);
            }
          },
        },
        duration: 5000,
      });
    },
    [removeReference, addReference]
  );

  const exportToBibtex = useCallback(async (id: string) => {
    const bibtex = await window.go.main.App.ExportToBibtex(id);
    return bibtex;
  }, []);

  const exportAllToBibtex = useCallback(async () => {
    const bibtex = await window.go.main.App.ExportAllToBibtex();
    return bibtex;
  }, []);

  const exportSelectedToBibtex = useCallback(async () => {
    if (selectedIds.length === 0) {
      return exportAllToBibtex();
    }
    const bibtex = await window.go.main.App.ExportSelectedToBibtex(selectedIds);
    return bibtex;
  }, [selectedIds, exportAllToBibtex]);

  const saveBibtexToFile = useCallback(async (content: string) => {
    await window.go.main.App.SaveBibtexToFile(content);
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const allTags = await window.go.main.App.GetAllTags();
      setTags(allTags || []);
    } catch (err) {
      console.error("Failed to fetch tags:", err);
    }
  }, [setTags]);

  const filterByTag = useCallback(
    async (tagName: string | null) => {
      setSelectedTag(tagName);
      setSelectedFolderId(null);
      setLoading(true);
      setError(null);
      try {
        if (tagName) {
          const refs = await window.go.main.App.GetReferencesByTag(tagName);
          setReferences(refs || []);
        } else {
          const refs = await window.go.main.App.GetAllReferences();
          setReferences(refs || []);
        }
      } catch (err) {
        setError(parseErrorMessage(err, "Failed to filter by tag"));
      } finally {
        setLoading(false);
      }
    },
    [setReferences, setSelectedTag, setSelectedFolderId, setLoading, setError]
  );

  const fetchFolders = useCallback(async () => {
    try {
      const allFolders = await window.go.main.App.GetAllFolders();
      setFolders(allFolders || []);
    } catch (err) {
      console.error("Failed to fetch folders:", err);
    }
  }, [setFolders]);

  const createFolder = useCallback(
    async (name: string) => {
      const folder = await window.go.main.App.CreateFolder(name);
      await fetchFolders();
      return folder;
    },
    [fetchFolders]
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      await window.go.main.App.DeleteFolder(id);
      await fetchFolders();
      if (selectedFolderId === id) {
        setSelectedFolderId(null);
        const refs = await window.go.main.App.GetAllReferences();
        setReferences(refs || []);
      }
    },
    [fetchFolders, setSelectedFolderId, setReferences, selectedFolderId]
  );

  const filterByFolder = useCallback(
    async (folderId: string | null) => {
      setSelectedFolderId(folderId);
      setSelectedTag(null);
      setLoading(true);
      setError(null);
      try {
        if (folderId) {
          const refs = await window.go.main.App.GetReferencesByFolder(folderId);
          setReferences(refs || []);
        } else {
          const refs = await window.go.main.App.GetAllReferences();
          setReferences(refs || []);
        }
      } catch (err) {
        setError(parseErrorMessage(err, "Failed to filter by folder"));
      } finally {
        setLoading(false);
      }
    },
    [setReferences, setSelectedFolderId, setSelectedTag, setLoading, setError]
  );

  const addReferencesToFolder = useCallback(
    async (refIDs: string[], folderID: string) => {
      await window.go.main.App.AddReferencesToFolder(refIDs, folderID);
      setLoading(true);
      setError(null);
      try {
        if (selectedFolderId) {
          const refs = await window.go.main.App.GetReferencesByFolder(selectedFolderId);
          setReferences(refs || []);
        } else if (selectedTag) {
          const refs = await window.go.main.App.GetReferencesByTag(selectedTag);
          setReferences(refs || []);
        } else {
          const refs = await window.go.main.App.GetAllReferences();
          setReferences(refs || []);
        }
      } catch (err) {
        setError(parseErrorMessage(err, "Failed to refresh references"));
      } finally {
        setLoading(false);
      }
      await fetchFolders();
    },
    [setReferences, setLoading, setError, selectedFolderId, selectedTag, fetchFolders]
  );

  return {
    references,
    selectedIds,
    searchQuery,
    isLoading,
    error,
    tags,
    selectedTag,
    folders,
    selectedFolderId,
    fetchReferences,
    refreshReferences,
    searchReferences,
    createReference,
    editReference,
    deleteReference,
    deleteReferenceWithUndo,
    exportToBibtex,
    exportAllToBibtex,
    exportSelectedToBibtex,
    saveBibtexToFile,
    copyToClipboard,
    setSelectedIds,
    toggleSelected,
    selectAll,
    clearSelection,
    fetchTags,
    filterByTag,
    fetchFolders,
    createFolder,
    deleteFolder,
    filterByFolder,
    addReferencesToFolder,
    ollamaSearchReferences,
    checkOllamaStatus,
    searchMode,
    ollamaSettings,
    setSearchMode,
    setOllamaSettings,
  };
}
