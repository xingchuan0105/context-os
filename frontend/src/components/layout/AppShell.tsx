'use client'

import { AppSidebar } from './AppSidebar'
import { SystemStatusBar } from '@/components/status/SystemStatusBar'
import { ModalProvider } from '@/components/providers/ModalProvider'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <SystemStatusBar />
        {children}
      </main>
      <ModalProvider />
    </div>
  )
}
