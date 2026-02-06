'use client'

/**
 * ChatInput - 聊天输入区域组件
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'
import { Send, Loader2 } from 'lucide-react'
import { forwardRef } from 'react'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onAbort?: () => void
  isLoading?: boolean
  disabled?: boolean
  error?: string | null
  placeholder?: string
  showWarning?: boolean
  warningMessage?: string
  className?: string
}

export const ChatInput = forwardRef<HTMLInputElement, ChatInputProps>(
  (
    {
      value,
      onChange,
      onSend,
      onAbort,
      isLoading = false,
      disabled = false,
      error = null,
      placeholder = '输入消息... (Enter 发送, Shift+Enter 换行)',
      showWarning = false,
      warningMessage = '',
      className,
    },
    ref
  ) => {
    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (!isLoading && value.trim()) {
          onSend()
        }
      }
    }

    return (
      <div className={className}>
        {showWarning && warningMessage && (
          <Notice className="mb-2">{warningMessage}</Notice>
        )}

        {error && (
          <Notice variant="error" className="mb-2">
            <span className="truncate">
              {typeof error === 'string' ? error : JSON.stringify(error)}
            </span>
          </Notice>
        )}

        <div className="flex gap-2">
          <Input
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
            disabled={isLoading || disabled}
            className="flex-1"
          />
          <Button
            onClick={isLoading ? onAbort : onSend}
            disabled={isLoading ? false : !value.trim() || disabled}
            variant={isLoading ? 'destructive' : 'default'}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                停止
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                发送
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }
)

ChatInput.displayName = 'ChatInput'
