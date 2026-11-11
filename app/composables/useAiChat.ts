/**
 * useAiChat — Composable for interacting with the AI Teaching Assistant.
 *
 * Manages chat messages, streaming responses, and connection state.
 * Uses the Nuxt server route /api/ai/chat for both demo and real AI modes.
 *
 * Every request carries the lessons of the user's courses (`context.lessons`)
 * so the tutor can answer from the material; the reply carries `sources`
 * (lessons the answer came from), in JSON and as the final SSE event.
 */
import { useNotification } from '~/composables/useNotification'
import { useAuthStore } from '~/stores/auth'
import { useCoursesStore } from '~/stores/courses'

/** A lesson the answer was grounded in (mirrors `RagSource` in server/utils/rag.ts). */
export interface ChatSource {
  lesson_id: string
  course_id: string
  course_kode: string
  judul: string
  excerpt: string
  score: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  sources?: ChatSource[]
}

// Client-side caps, kept in line with the server's (server/utils/rag.ts).
const MAX_CONTEXT_LESSONS = 100
const MAX_LESSON_CHARS = 20_000
const MAX_CONTEXT_TOTAL_CHARS = 150_000

/** Keep only well-formed source objects (older servers sent `string[]` / nothing). */
export function normalizeSources(raw: unknown): ChatSource[] {
  if (!Array.isArray(raw)) return []
  const out: ChatSource[] = []
  const seen = new Set<string>()
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue
    const r = s as Record<string, unknown>
    if (typeof r.lesson_id !== 'string' || typeof r.course_id !== 'string' || seen.has(r.lesson_id)) continue
    seen.add(r.lesson_id)
    out.push({
      lesson_id: r.lesson_id,
      course_id: r.course_id,
      course_kode: typeof r.course_kode === 'string' ? r.course_kode : '',
      judul: typeof r.judul === 'string' && r.judul ? r.judul : 'Materi',
      excerpt: typeof r.excerpt === 'string' ? r.excerpt : '',
      score: typeof r.score === 'number' ? r.score : 0,
    })
  }
  return out
}

/**
 * Default chat context: the user's courses and their lessons (capped).
 * Initialises the courses store first if the app has not done so yet (e.g. the
 * chat page was opened before the global init finished).
 * Returns `undefined` when the stores are unavailable (e.g. isolated tests).
 */
export async function buildChatContext(): Promise<Record<string, unknown> | undefined> {
  try {
    const courses = useCoursesStore()
    if (!courses.initialized) await courses.init()
    const myCourses = courses.myCourses
    const lessons: Array<Record<string, string>> = []
    let total = 0
    for (const l of courses.getLessonsForAi()) {
      if (lessons.length >= MAX_CONTEXT_LESSONS) break
      const konten = l.konten.slice(0, MAX_LESSON_CHARS)
      if (total + konten.length > MAX_CONTEXT_TOTAL_CHARS) continue
      total += konten.length
      lessons.push({ ...l, konten })
    }
    return {
      courses: myCourses.map((c) => ({ kode: c.kode, nama: c.nama, deskripsi: c.deskripsi || '' })),
      lessons,
    }
  } catch {
    return undefined
  }
}

/**
 * Where a source chip links to: the student lesson page, or the instructor's
 * lesson management page. `null` for roles without a lesson page (admin).
 */
export function sourceLink(source: Pick<ChatSource, 'course_id' | 'lesson_id'>, role: string | null | undefined): string | null {
  const c = encodeURIComponent(source.course_id)
  if (role === 'student') return `/courses/${c}/lessons/${encodeURIComponent(source.lesson_id)}`
  if (role === 'instructor') return `/instructor/courses/${c}/lessons`
  return null
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
    state.messages.push({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    })
    // Mutate through the reactive proxy so streamed words and sources re-render.
    const assistantMsg = state.messages[state.messages.length - 1]!

    abortController = new AbortController()

    try {
      if (context === undefined) context = await buildChatContext()
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
        assistantMsg.sources = normalizeSources(data.sources)
        return
      }

      // Handle streaming response (SSE)
      const reader = response.body?.getReader()
      if (!reader) {
        const data = await response.json()
        assistantMsg.content = data.reply || 'Tidak ada respons.'
        assistantMsg.sources = normalizeSources(data.sources)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      // Final event: { sources: [...], done: true }. Older servers send only { word }.
      const handleEvent = (line: string) => {
        if (!line.startsWith('data: ')) return
        try {
          const data = JSON.parse(line.slice(6))
          if (typeof data.word === 'string' && data.word) {
            assistantMsg.content += data.word
          }
          if (Array.isArray(data.sources)) {
            assistantMsg.sources = normalizeSources(data.sources)
          }
        } catch {
          // skip malformed chunks
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) handleEvent(line)
      }

      // Process remaining buffer
      buffer += decoder.decode()
      for (const line of buffer.split('\n')) handleEvent(line)
      if (!assistantMsg.content) assistantMsg.content = 'Tidak ada respons.'
    } catch (err: any) {
      if (err.name === 'AbortError') {
        assistantMsg.content += '\n\n_(respons dihentikan)_'
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
