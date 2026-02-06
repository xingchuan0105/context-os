'use client'

import { useModalManager } from '@/lib/hooks/use-modal-manager'
import { NoteEditorDialog } from '@/app/(dashboard)/notebooks/components/NoteEditorDialog'
import { SourceDialog } from '@/components/source/SourceDialog'

/**
 * Modal Provider Component
 *
 * Renders modals based on URL query parameters (?modal=type&id=xxx)
 * Manages modal state through the useModalManager hook
 *
 * Supported modal types:
 * - source: Source detail modal
 * - note: Note editor modal
 */
export function ModalProvider() {
  const { modalType, modalId, closeModal } = useModalManager()

  return (
    <>
      {/* Source Modal */}
      <SourceDialog
        open={modalType === 'source'}
        onOpenChange={(open) => {
          if (!open) closeModal()
        }}
        sourceId={modalId}
      />

      {/* Note Modal */}
      <NoteEditorDialog
        open={modalType === 'note'}
        onOpenChange={(open) => {
          if (!open) closeModal()
        }}
        notebookId="" // Will need to be fetched or handled in Phase 9
        note={modalId ? { id: modalId, title: null, content: null } : undefined}
      />

    </>
  )
}
