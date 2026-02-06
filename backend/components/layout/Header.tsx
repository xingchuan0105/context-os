'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Breadcrumb } from './Breadcrumb'

export function Header() {
  const pathname = usePathname()

  // Don't show header on login page
  if (pathname === '/login') {
    return null
  }

  return (
    <header className="h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 shrink-0">
      <div className="flex-1">
        <Breadcrumb />
      </div>
    </header>
  )
}
