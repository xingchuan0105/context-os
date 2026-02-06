import { create } from 'zustand'

export interface KnowledgeBase {
  id: string
  title: string
  description: string | null
  user_id: string
  created_at: string
  updated_at: string
  document_count?: number
}

interface KBState {
  knowledgeBases: KnowledgeBase[]
  currentKB: KnowledgeBase | null
  isLoading: boolean
  error: string | null
  setKnowledgeBases: (kbs: KnowledgeBase[]) => void
  setCurrentKB: (kb: KnowledgeBase | null) => void
  addKnowledgeBase: (kb: KnowledgeBase) => void
  updateKnowledgeBase: (id: string, updates: Partial<KnowledgeBase>) => void
  deleteKnowledgeBase: (id: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useKBStore = create<KBState>((set) => ({
  knowledgeBases: [],
  currentKB: null,
  isLoading: false,
  error: null,

  setKnowledgeBases: (kbs) => set({ knowledgeBases: kbs || [] }),
  setCurrentKB: (kb) => set({ currentKB: kb }),

  addKnowledgeBase: (kb) =>
    set((state) => ({ knowledgeBases: [...state.knowledgeBases, kb] })),

  updateKnowledgeBase: (id, updates) =>
    set((state) => ({
      knowledgeBases: state.knowledgeBases.map((kb) =>
        kb.id === id ? { ...kb, ...updates } : kb
      ),
      currentKB: state.currentKB?.id === id
        ? { ...state.currentKB, ...updates }
        : state.currentKB,
    })),

  deleteKnowledgeBase: (id) =>
    set((state) => ({
      knowledgeBases: state.knowledgeBases.filter((kb) => kb.id !== id),
      currentKB: state.currentKB?.id === id ? null : state.currentKB,
    })),

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}))

// ==================== Selectors ====================

/**
 * Selector hooks for optimized re-rendering
 */

/** Get all knowledge bases */
export const useKnowledgeBases = () => useKBStore((state) => state.knowledgeBases)

/** Get current knowledge base */
export const useCurrentKB = () => useKBStore((state) => state.currentKB)

/** Get loading state */
export const useKBLoading = () => useKBStore((state) => state.isLoading)

/** Get error state */
export const useKBError = () => useKBStore((state) => state.error)

/** Get KB actions */
export const useKBActions = () => useKBStore((state) => ({
  setKnowledgeBases: state.setKnowledgeBases,
  setCurrentKB: state.setCurrentKB,
  addKnowledgeBase: state.addKnowledgeBase,
  updateKnowledgeBase: state.updateKnowledgeBase,
  deleteKnowledgeBase: state.deleteKnowledgeBase,
  setLoading: state.setLoading,
  setError: state.setError,
}))
