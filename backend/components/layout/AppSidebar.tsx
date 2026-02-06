'use client'

import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSidebarStore } from '@/lib/stores/sidebar-store'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  Database,
  Search,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  Plus,
  FolderOpen,
  FileText,
  Layers,
} from 'lucide-react'

const navigation = [
  {
    title: 'Knowledge',
    items: [
      { name: 'All Knowledge Bases', href: '/', icon: Database },
      { name: 'Search', href: '/search', icon: Search },
    ],
  },
  {
    title: 'Manage',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
] as const

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { isCollapsed, toggleCollapse } = useSidebarStore()

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_id')
    router.push('/login')
  }

  const handleCreateKb = () => {
    // Trigger KB creation dialog
    router.push('/?create=true')
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'app-sidebar flex h-full flex-col bg-sidebar border-border border-r transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center group',
            isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          )}
        >
          {isCollapsed ? (
            <div className="relative flex items-center justify-center w-full">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center transition-opacity group-hover:opacity-0">
                <Layers className="h-5 w-5 text-primary-foreground" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCollapse}
                className="absolute text-muted-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Layers className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-base font-medium text-foreground">
                  Context OS
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCollapse}
                className="text-muted-foreground hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <nav
          className={cn(
            'flex-1 space-y-1 py-4',
            isCollapsed ? 'px-2' : 'px-3'
          )}
        >
          <div
            className={cn(
              'mb-4',
              isCollapsed ? 'px-0' : 'px-3'
            )}
          >
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleCreateKb}
                    variant="default"
                    size="sm"
                    className="w-full justify-center px-2"
                    aria-label="Create Knowledge Base"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">New Knowledge Base</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                onClick={handleCreateKb}
                variant="default"
                size="sm"
                className="w-full justify-start"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Knowledge Base
              </Button>
            )}
          </div>

          {navigation.map((section, index) => (
            <div key={section.title}>
              {index > 0 && (
                <Separator className="my-3" />
              )}
              <div className="space-y-1">
                {!isCollapsed && (
                  <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.title}
                  </h3>
                )}

                {section.items.map((item) => {
                  const isActive = pathname === item.href

                  if (isCollapsed) {
                    return (
                      <Tooltip key={item.name}>
                        <TooltipTrigger asChild>
                          <Button
                            variant={isActive ? 'secondary' : 'ghost'}
                            className={cn(
                              'w-full gap-3',
                              isActive && 'bg-secondary',
                              isCollapsed ? 'justify-center px-2' : 'justify-start'
                            )}
                            onClick={() => router.push(item.href)}
                          >
                            <item.icon className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.name}</TooltipContent>
                      </Tooltip>
                    )
                  }

                  return (
                    <Button
                      key={item.name}
                      variant={isActive ? 'secondary' : 'ghost'}
                      className={cn(
                        'w-full gap-3',
                        isActive && 'bg-secondary',
                        isCollapsed ? 'justify-center px-2' : 'justify-start'
                      )}
                      onClick={() => router.push(item.href)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div
          className={cn(
            'border-t border-border p-3 space-y-2',
            isCollapsed && 'px-2'
          )}
        >
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-center"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign Out</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
