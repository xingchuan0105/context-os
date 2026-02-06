import { create } from 'zustand'

interface DialogState {
  createKbDialog: boolean
  uploadDocumentDialog: boolean
}

interface UIState extends DialogState {
  setCreateKbDialog: (open: boolean) => void
  setUploadDocumentDialog: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  createKbDialog: false,
  uploadDocumentDialog: false,
  setCreateKbDialog: (open) => set({ createKbDialog: open }),
  setUploadDocumentDialog: (open) => set({ uploadDocumentDialog: open }),
}))
