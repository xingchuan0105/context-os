/**
 * useChatInput - 输入状态与验证
 */

import { useState, useCallback } from 'react'

interface UseChatInputReturn {
  input: string
  setInput: (input: string) => void
  clearInput: () => void
  isValid: boolean
  handleKeyPress: (e: React.KeyboardEvent) => void
  onSend: (callback: () => void) => void
}

export function useChatInput(): UseChatInputReturn {
  const [input, setInput] = useState('')

  const isValid = input.trim().length > 0

  const clearInput = useCallback(() => {
    setInput('')
  }, [])

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
      }
    },
    []
  )

  const onSend = useCallback(
    (callback: () => void) => {
      if (isValid) {
        callback()
        clearInput()
      }
    },
    [isValid, clearInput]
  )

  return {
    input,
    setInput,
    clearInput,
    isValid,
    handleKeyPress,
    onSend,
  }
}
