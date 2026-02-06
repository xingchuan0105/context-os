'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { SourceDetailContent } from './SourceDetailContent'
import { useI18n } from '@/lib/i18n'

interface SourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceId: string | null
}

/**
 * Source Dialog Component
 *
 * Displays source details in a modal dialog.
 * Includes a "Chat with source" button that opens the full source page in a new tab.
 */
export function SourceDialog({ open, onOpenChange, sourceId }: SourceDialogProps) {
  const { t } = useI18n()
  const normalizedSourceId = sourceId ? sourceId.replace(/^source:/, '') : null

  const handleChatClick = () => {
    if (normalizedSourceId) {
      window.open(`/sources/${normalizedSourceId}`, '_blank')
      // Modal stays open after opening chat
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  if (!normalizedSourceId) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
        {/* Accessibility title (hidden visually but read by screen readers) */}
        <DialogTitle className="sr-only">{t('source.dialogTitle')}</DialogTitle>

        {/* Source detail content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <SourceDetailContent
            sourceId={normalizedSourceId}
            showChatButton={true}
            onChatClick={handleChatClick}
            onClose={handleClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
