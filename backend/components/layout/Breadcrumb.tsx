'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ChevronRight, Home, Database } from 'lucide-react'

export function Breadcrumb() {
  const pathname = usePathname()

  // Generate breadcrumb from pathname
  const segments = pathname.split('/').filter(Boolean)

  const breadcrumbs = segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/')
    const isLast = index === segments.length - 1

    // Format segment for display
    let display = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    // Special handling for known paths
    if (segment === 'kb' || segment === 'knowledge-base') {
      display = 'Knowledge Base'
    } else if (segment === 'documents') {
      display = 'Documents'
    } else if (segment === 'settings') {
      display = 'Settings'
    }

    return { path, display, isLast }
  })

  // Don't show breadcrumb on home page
  if (breadcrumbs.length === 0) {
    return <div className="text-sm text-muted-foreground">Welcome</div>
  }

  return (
    <nav className="flex items-center text-sm text-muted-foreground">
      <a
        href="/"
        className="flex items-center hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
        <span className="sr-only">Home</span>
      </a>

      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center">
          <ChevronRight className="mx-1 h-4 w-4" />
          {crumb.isLast ? (
            <span className="text-foreground font-medium">{crumb.display}</span>
          ) : (
            <a
              href={crumb.path}
              className="hover:text-foreground transition-colors"
            >
              {crumb.display}
            </a>
          )}
        </div>
      ))}
    </nav>
  )
}
