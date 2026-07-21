/**
 * useAiChat — Composable for interacting with the AI Teaching Assistant.
 *
 * Manages chat messages, streaming responses, and connection state.
 * Uses the Nuxt server route /api/ai/chat for both demo and real AI modes.
 */
import { useNotification } from '~/composables/useNotification'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  sources?: string[]
}

interface ChatState {
  messages: ChatMessage[]
  isProcessing: boolean
  error: string | null
}

export function useAiChat() {
  const { error: showError } = useNotification()
  const state = reactive<ChatState>({
    messages: [],
    isProcessing: false,
    error: null,
  })

  let abortController: AbortController | null = null

  /**
   * Send a message to the AI assistant.
   * Supports streaming via SSE if the server supports it.
   */
  async function sendMessage(content: string, context?: Record<string, unknown>) {
    if (!content.trim() || state.isProcessing) return

    state.error = null
    state.isProcessing = true

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }
    state.messages.push(userMsg)

    // Create placeholder assistant message
    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }
    state.messages.push(assistantMsg)

    abortController = new AbortController()

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ message: content.trim(), context }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(errData?.statusMessage || `HTTP ${response.status}`)
      }

      // Check if server returned JSON (non-streaming fallback)
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const data = await response.json()
        assistantMsg.content = data.reply || 'Tidak ada respons.'
        assistantMsg.sources = data.sources
        return
      }

      // Handle streaming response (SSE)
      const reader = response.body?.getReader()
      if (!reader) {
        const data = await response.json()
        assistantMsg.content = data.reply || 'Tidak ada respons.'
        assistantMsg.sources = data.sources
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.word) {
                assistantMsg.content += data.word
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.slice(6))
          if (data.word) {
            assistantMsg.content += data.word
          }
        } catch {
          // skip
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        assistantMsg.content += '\n\n_(pernelponan dihentikan)_'
        return
      }
      const errMsg = err.message || 'Gagal terhubung ke AI assistant.'
      state.error = errMsg
      assistantMsg.content = `Maaf, terjadi kesalahan: ${errMsg}. Coba lagi nanti.`
      showError(errMsg)
    } finally {
      state.isProcessing = false
      abortController = null
    }
  }

  /**
   * Cancel an ongoing AI response.
   */
  function cancelResponse() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    state.isProcessing = false
  }

  /**
   * Clear all chat messages.
   */
  function clearChat() {
    cancelResponse()
    state.messages = []
    state.error = null
  }

  /**
   * Remove a single message by id.
   */
  function removeMessage(id: string) {
    state.messages = state.messages.filter((m) => m.id !== id)
  }

  /**
   * Format a Date for chat timestamps (Indonesian locale).
   */
  function formatTime(date: Date): string {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  /**
   * Render markdown-style content to safe HTML.
   * Handles code blocks, inline code, bold, italic, and line breaks.
   */
  function renderMarkdown(content: string): string {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
  }

  return {
    messages: computed(() => state.messages),
    isProcessing: computed(() => state.isProcessing),
    error: computed(() => state.error),
    hasMessages: computed(() => state.messages.length > 0),
    lastMessage: computed(() => state.messages[state.messages.length - 1] || null),
    sendMessage,
    cancelResponse,
    clearChat,
    removeMessage,
    formatTime,
    renderMarkdown,
  }
}
