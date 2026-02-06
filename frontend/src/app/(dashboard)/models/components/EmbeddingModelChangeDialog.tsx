'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

interface EmbeddingModelChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  oldModelName?: string
  newModelName?: string
}

export function EmbeddingModelChangeDialog({
  open,
  onOpenChange,
  onConfirm,
  oldModelName,
  newModelName
}: EmbeddingModelChangeDialogProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [isConfirming, setIsConfirming] = useState(false)

  const handleConfirmAndRebuild = () => {
    setIsConfirming(true)
    onConfirm()
    // Give a moment for the model to update, then redirect
    setTimeout(() => {
      router.push('/advanced')
      onOpenChange(false)
      setIsConfirming(false)
    }, 500)
  }

  const handleConfirmOnly = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <AlertDialogTitle>{t('models.embeddingChange.title')}</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-base text-muted-foreground">
              <p>
                {oldModelName && newModelName
                  ? t('models.embeddingChange.descriptionFull', {
                      old: oldModelName,
                      new: newModelName,
                    })
                  : t('models.embeddingChange.description')}
              </p>

              <div className="bg-muted p-4 rounded-md space-y-2">
                <p className="font-semibold text-foreground">
                  {t('models.embeddingChange.importantTitle')}
                </p>
                <p className="text-sm">{t('models.embeddingChange.importantDescription')}</p>
              </div>

              <div className="space-y-2 text-sm">
                <p className="font-medium text-foreground">
                  {t('models.embeddingChange.nextTitle')}
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>{t('models.embeddingChange.nextItem1')}</li>
                  <li>{t('models.embeddingChange.nextItem2')}</li>
                  <li>{t('models.embeddingChange.nextItem3')}</li>
                  <li>{t('models.embeddingChange.nextItem4')}</li>
                </ul>
              </div>

              <p className="text-sm font-medium text-foreground">
                {t('models.embeddingChange.prompt')}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={isConfirming}>
            {t('action.cancel')}
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={handleConfirmOnly}
            disabled={isConfirming}
          >
            {t('models.embeddingChange.confirmOnly')}
          </Button>
          <AlertDialogAction
            onClick={handleConfirmAndRebuild}
            disabled={isConfirming}
            className="bg-primary"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            {t('models.embeddingChange.confirmRebuild')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
