'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { CreateModelRequest, ProviderAvailability } from '@/lib/types/models'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useCreateModel } from '@/lib/hooks/use-models'
import { Plus } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

interface AddModelFormProps {
  modelType: 'language' | 'embedding' | 'text_to_speech' | 'speech_to_text'
  providers: ProviderAvailability
}

export function AddModelForm({ modelType, providers }: AddModelFormProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const createModel = useCreateModel()
  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<CreateModelRequest>({
    defaultValues: {
      type: modelType
    }
  })

  // Get available providers that support this model type
  const availableProviders = providers.available.filter(provider =>
    providers.supported_types[provider]?.includes(modelType)
  )

  const onSubmit = async (data: CreateModelRequest) => {
    await createModel.mutateAsync(data)
    reset()
    setOpen(false)
  }

  const getModelTypeLabel = (type: AddModelFormProps['modelType']) => {
    switch (type) {
      case 'language':
        return t('models.type.language')
      case 'embedding':
        return t('models.type.embedding')
      case 'text_to_speech':
        return t('models.type.textToSpeech')
      case 'speech_to_text':
        return t('models.type.speechToText')
    }
  }

  const modelTypeLabel = getModelTypeLabel(modelType)

  const getModelPlaceholder = () => {
    switch (modelType) {
      case 'language':
        return t('models.add.namePlaceholder.language')
      case 'embedding':
        return t('models.add.namePlaceholder.embedding')
      case 'text_to_speech':
        return t('models.add.namePlaceholder.textToSpeech')
      case 'speech_to_text':
        return t('models.add.namePlaceholder.speechToText')
      default:
        return t('models.add.namePlaceholder.default')
    }
  }

  if (availableProviders.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        {t('models.add.noProviders', { type: modelTypeLabel })}
      </div>
    )
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          {t('models.add.button')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('models.add.title', { type: modelTypeLabel })}</DialogTitle>
          <DialogDescription>
            {t('models.add.description', { type: modelTypeLabel })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="provider">{t('models.add.providerLabel')}</Label>
            <Select onValueChange={(value) => setValue('provider', value)} required>
              <SelectTrigger>
                <SelectValue placeholder={t('models.add.providerPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {availableProviders.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    <span className="capitalize">{provider}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.provider && (
              <p className="text-sm text-destructive mt-1">{t('models.add.providerRequired')}</p>
            )}
          </div>

          <div>
            <Label htmlFor="name">{t('models.add.nameLabel')}</Label>
            <Input
              id="name"
              {...register('name', { required: t('models.add.nameRequired') })}
              placeholder={getModelPlaceholder()}
            />
            {errors.name && (
              <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {modelType === 'language' && watch('provider') === 'azure' &&
                t('models.add.azureHint')}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('action.cancel')}
            </Button>
            <Button type="submit" disabled={createModel.isPending}>
              {createModel.isPending ? t('models.add.adding') : t('models.add.button')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
