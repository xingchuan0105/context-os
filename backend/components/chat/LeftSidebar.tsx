'use client'

/**
 * 左侧边栏容器
 * 包含对话历史和文件源两个可折叠区域
 */

import { ReactNode } from 'react'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

interface LeftSidebarProps {
  children: ReactNode
  className?: string
}

export function LeftSidebar({ children, className }: LeftSidebarProps) {
  return (
    <div className={className}>
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-0 p-2">{children}</div>
      </ScrollArea>
    </div>
  )
}

/**
 * 左侧边栏分割线
 */
export function SidebarSeparator() {
  return <Separator className="my-2" />
}
