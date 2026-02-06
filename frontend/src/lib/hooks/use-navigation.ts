import { useNavigationStore } from '@/lib/stores/navigation-store'
import { useI18n } from '@/lib/i18n'

export function useNavigation() {
  const store = useNavigationStore()
  const { t } = useI18n()

  return {
    setReturnTo: store.setReturnTo,
    clearReturnTo: store.clearReturnTo,
    getReturnPath: store.getReturnPath,
    getReturnLabel: () => store.getReturnLabel() || t('nav.backToSources'),
    returnTo: store.returnTo
  }
}
