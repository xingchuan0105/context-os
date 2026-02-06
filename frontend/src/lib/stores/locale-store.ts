import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Locale = 'zh' | 'en'

interface LocaleState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const getDefaultLocale = (): Locale => {
  if (typeof navigator === 'undefined') {
    return 'zh'
  }
  const lang = navigator.language?.toLowerCase() ?? ''
  return lang.startsWith('zh') ? 'zh' : 'en'
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: getDefaultLocale(),
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'locale-store' }
  )
)
