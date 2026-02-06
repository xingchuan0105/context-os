import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export default function ResetPasswordPage() {
  return (
    <ErrorBoundary>
      <ResetPasswordForm />
    </ErrorBoundary>
  )
}
