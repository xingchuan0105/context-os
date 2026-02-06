'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UIMessage } from 'ai'

type TypewriterOptions = {
  enabled?: boolean
  minDelayMs?: number
  maxDelayMs?: number
  minCharsPerTick?: number
  maxCharsPerTick?: number
}

type TypewriterState = {
  id: string | null
  displayedLength: number
  fullText: string
}

const DEFAULT_OPTIONS: Required<TypewriterOptions> = {
  enabled: true,
  minDelayMs: 16,
  maxDelayMs: 48,
  minCharsPerTick: 1,
  maxCharsPerTick: 6,
}

function getMessageText(message: UIMessage): string {
  const parts = (message as { parts?: Array<{ type: string; text?: string }> }).parts
  if (Array.isArray(parts)) {
    const text = parts
      .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('')
    if (text) return text
  }
  const fallback = (message as { content?: string }).content
  return typeof fallback === 'string' ? fallback : ''
}

function findLatestAssistant(messages: UIMessage[]): UIMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message?.role === 'assistant') {
      return message
    }
  }
  return undefined
}

function findStreamingAssistant(messages: UIMessage[], baselineId?: string | null): UIMessage | undefined {
  if (!baselineId) {
    return findLatestAssistant(messages)
  }
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message?.role === 'assistant' && message.id !== baselineId) {
      return message
    }
  }
  return undefined
}

function withTruncatedText(message: UIMessage, text: string): UIMessage {
  return {
    ...message,
    parts: [{ type: 'text', text }],
  }
}

function buildDisplayMessages(messages: UIMessage[], targetId: string, displayText: string): UIMessage[] {
  let replaced = false
  return messages.map((message) => {
    if (!replaced && message.id === targetId && message.role === 'assistant') {
      replaced = true
      return withTruncatedText(message, displayText)
    }
    return message
  })
}

export function useTypewriterMessages(
  messages: UIMessage[],
  enabled: boolean,
  options?: TypewriterOptions,
  baselineAssistantId?: string | null
) {
  const settings = useMemo(
    () => ({
      ...DEFAULT_OPTIONS,
      ...options,
      enabled,
    }),
    [options, enabled]
  )
  const settingsRef = useRef(settings)
  const messagesRef = useRef(messages)
  const [displayMessages, setDisplayMessages] = useState<UIMessage[]>(messages)
  const stateRef = useRef<TypewriterState>({
    id: null,
    displayedLength: 0,
    fullText: '',
  })
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const updateDisplay = useCallback((allMessages: UIMessage[], targetId: string, text: string) => {
    setDisplayMessages(buildDisplayMessages(allMessages, targetId, text))
  }, [])

  const tick = useCallback(() => {
    const currentSettings = settingsRef.current
    if (!currentSettings.enabled) {
      clearTimer()
      return
    }

    const currentMessages = messagesRef.current
    const latestAssistant = findStreamingAssistant(currentMessages, baselineAssistantId)
    if (!latestAssistant) {
      setDisplayMessages(currentMessages)
      clearTimer()
      return
    }

    const fullText = getMessageText(latestAssistant)
    let state = stateRef.current

    if (state.id !== latestAssistant.id) {
      state = {
        id: latestAssistant.id,
        displayedLength: fullText.length > 0 ? 1 : 0,
        fullText,
      }
    } else {
      state.fullText = fullText
      if (state.displayedLength > fullText.length) {
        state.displayedLength = fullText.length
      }
    }

    if (state.displayedLength < fullText.length) {
      const backlog = fullText.length - state.displayedLength
      const ratio = Math.min(1, backlog / 120)
      const step = Math.max(
        currentSettings.minCharsPerTick,
        Math.round(
          currentSettings.minCharsPerTick +
            ratio * (currentSettings.maxCharsPerTick - currentSettings.minCharsPerTick)
        )
      )
      const delay = Math.round(
        currentSettings.maxDelayMs -
          ratio * (currentSettings.maxDelayMs - currentSettings.minDelayMs)
      )
      state.displayedLength = Math.min(fullText.length, state.displayedLength + step)
      stateRef.current = state
      updateDisplay(currentMessages, latestAssistant.id, fullText.slice(0, state.displayedLength))
      timerRef.current = window.setTimeout(tick, delay)
      return
    }

    stateRef.current = state
    updateDisplay(currentMessages, latestAssistant.id, fullText)
    clearTimer()
  }, [baselineAssistantId, clearTimer, updateDisplay])

  useEffect(() => {
    messagesRef.current = messages

    if (!settings.enabled) {
      clearTimer()
      setDisplayMessages(messages)
      return
    }

    const latestAssistant = findStreamingAssistant(messages, baselineAssistantId)
    if (!latestAssistant) {
      clearTimer()
      setDisplayMessages(messages)
      return
    }

    const fullText = getMessageText(latestAssistant)
    let state = stateRef.current
    if (state.id !== latestAssistant.id) {
      state = {
        id: latestAssistant.id,
        displayedLength: fullText.length > 0 ? 1 : 0,
        fullText,
      }
    } else {
      state.fullText = fullText
      if (state.displayedLength > fullText.length) {
        state.displayedLength = fullText.length
      }
    }
    stateRef.current = state

    const displayText = fullText.slice(0, state.displayedLength)
    setDisplayMessages(buildDisplayMessages(messages, latestAssistant.id, displayText))

    if (state.displayedLength < fullText.length) {
      clearTimer()
      timerRef.current = window.setTimeout(tick, settings.minDelayMs)
    }
  }, [messages, settings.enabled, settings.minDelayMs, baselineAssistantId, clearTimer, tick])

  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [clearTimer])

  return displayMessages
}

