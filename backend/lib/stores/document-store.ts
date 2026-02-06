import { create } from 'zustand'
import type { Document as ApiDocument, DocumentStatus as ApiDocumentStatus } from '@/lib/api/types'

export type Document = ApiDocument
export type DocumentStatus = ApiDocumentStatus

interface DocumentState {
  documents: Document[]
  currentDocument: Document | null
  isLoading: boolean
  error: string | null
  uploadProgress: Record<string, number>
  setDocuments: (docs: Document[]) => void
  setCurrentDocument: (doc: Document | null) => void
  addDocument: (doc: Document) => void
  updateDocument: (id: string, updates: Partial<Document>) => void
  deleteDocument: (id: string) => void
  setUploadProgress: (docId: string, progress: number) => void
  clearUploadProgress: (docId: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  currentDocument: null,
  isLoading: false,
  error: null,
  uploadProgress: {},

  setDocuments: (docs) => set({ documents: docs || [] }),
  setCurrentDocument: (doc) => set({ currentDocument: doc }),

  addDocument: (doc) =>
    set((state) => ({ documents: [...state.documents, doc] })),

  updateDocument: (id, updates) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === id ? { ...doc, ...updates } : doc
      ),
      currentDocument: state.currentDocument?.id === id
        ? { ...state.currentDocument, ...updates }
        : state.currentDocument,
    })),

  deleteDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((doc) => doc.id !== id),
      currentDocument: state.currentDocument?.id === id ? null : state.currentDocument,
    })),

  setUploadProgress: (docId, progress) =>
    set((state) => ({
      uploadProgress: { ...state.uploadProgress, [docId]: progress },
    })),

  clearUploadProgress: (docId) =>
    set((state) => {
      const newProgress = { ...state.uploadProgress }
      delete newProgress[docId]
      return { uploadProgress: newProgress }
    }),

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}))

// ==================== Selectors ====================

/**
 * Selector hooks for optimized re-rendering
 * Use these to subscribe only to the state you need
 */

/** Get all documents */
export const useDocuments = () => useDocumentStore((state) => state.documents)

/** Get current document */
export const useCurrentDocument = () => useDocumentStore((state) => state.currentDocument)

/** Get loading state */
export const useDocumentsLoading = () => useDocumentStore((state) => state.isLoading)

/** Get error state */
export const useDocumentsError = () => useDocumentStore((state) => state.error)

/** Get upload progress */
export const useUploadProgress = () => useDocumentStore((state) => state.uploadProgress)

/** Get document actions (to avoid subscribing to data changes) */
export const useDocumentActions = () => useDocumentStore((state) => ({
  setDocuments: state.setDocuments,
  setCurrentDocument: state.setCurrentDocument,
  addDocument: state.addDocument,
  updateDocument: state.updateDocument,
  deleteDocument: state.deleteDocument,
  setUploadProgress: state.setUploadProgress,
  clearUploadProgress: state.clearUploadProgress,
  setLoading: state.setLoading,
  setError: state.setError,
}))

