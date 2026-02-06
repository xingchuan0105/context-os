'use client'

import { AppShell } from '@/components/layout/AppShell'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useI18n } from '@/lib/i18n'
import { Settings, Languages } from 'lucide-react'

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n()

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
              <Settings className="h-3 w-3" />
              {t('settings.title')}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {t('settings.title')}
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              {t('settings.languageHint')}
            </p>
          </div>

          <section className="max-w-xl rounded-2xl border border-border/70 bg-card/70 p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Languages className="h-4 w-4 text-primary" />
              {t('label.language')}
            </div>
            <Select
              value={locale}
              onValueChange={(value) => setLocale(value as 'zh' | 'en')}
            >
              <SelectTrigger className="w-full bg-card/70 border-border/60">
                <SelectValue placeholder={t('label.language')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
