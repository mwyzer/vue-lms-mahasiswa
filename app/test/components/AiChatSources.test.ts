/**
 * AI tutor client — sources ("📖 Sumber") and lesson context.
 *
 * Covers useAiChat (context.lessons in the request, sources from JSON and from
 * the final SSE event, legacy servers) and AiChat.vue rendering of source chips.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AiChat from '~/components/common/AiChat.vue'
import { useAiChat, normalizeSources, sourceLink, buildChatContext } from '~/composables/useAiChat'
import { useAuthStore } from '~/stores/auth'
import { useCoursesStore } from '~/stores/courses'

vi.mock('~/composables/useNotification', () => ({
  useNotification: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}))

const SRC = {
  lesson_id: 'l4',
  course_id: 'c1',
  course_kode: 'MK101',
  judul: 'Perulangan (Looping)',
  excerpt: 'Perulangan digunakan untuk menjalankan blok kode yang sama berkali-kali.',
  score: 0.41,
}

function sseResponse(chunks: string[]) {
  const body = new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch))
      c.close()
    },
  })
  return { ok: true, body, headers: new Headers({ 'content-type': 'text/event-stream' }) }
}

async function loginS1() {
  const courses = useCoursesStore()
  await courses.init()
  const auth = useAuthStore()
  auth.students = [{ id: 's1', nama: 'Ahmad Fauzi', npm: '20241001', kelas: '1A', level: 1, session_time: 'morning' }] as any
  await auth.loginAsStudent('Ahmad Fauzi', '20241001', 'mahasiswa123')
}

const NuxtLinkStub = { props: ['to'], template: '<a :href="to" class="nuxt-link"><slot /></a>' }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useAiChat helpers', () => {
  it('normalizeSources keeps well-formed objects, dedupes, tolerates legacy string[]', () => {
    expect(normalizeSources(undefined)).toEqual([])
    expect(normalizeSources(['Materi A'])).toEqual([])
    expect(normalizeSources([SRC, { ...SRC, score: 0.1 }, { lesson_id: 1 }, null])).toEqual([SRC])
    expect(normalizeSources([{ lesson_id: 'x', course_id: 'c' }])[0]).toMatchObject({ judul: 'Materi', excerpt: '', course_kode: '' })
  })

  it('sourceLink: student lesson page, instructor lessons page, none for admin', () => {
    expect(sourceLink(SRC, 'student')).toBe('/courses/c1/lessons/l4')
    expect(sourceLink(SRC, 'instructor')).toBe('/instructor/courses/c1/lessons')
    expect(sourceLink(SRC, 'admin')).toBeNull()
  })

  it('buildChatContext sends the lessons of my courses', async () => {
    await loginS1()
    const ctx = (await buildChatContext())!
    expect((ctx.courses as any[]).map((c) => c.kode)).toEqual(['MK101', 'MK102'])
    const lessons = ctx.lessons as any[]
    expect(lessons.map((l) => l.id)).toEqual(['l1', 'l2', 'l3', 'l4', 'l5', 'l6'])
    expect(lessons[0]).toEqual(expect.objectContaining({ course_id: 'c1', course_kode: 'MK101', judul: 'Pengantar Pemrograman', konten: expect.any(String) }))
  })
})

describe('useAiChat requests', () => {
  it('posts context.lessons by default and reads sources from the final SSE event', async () => {
    await loginS1()
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"word":"Berdasarkan "}\n\ndata: {"wo',
        'rd":"materi"}\n\n',
        `data: ${JSON.stringify({ sources: [SRC], done: true })}\n\n`,
      ]),
    )
    globalThis.fetch = fetchMock as any
    const chat = useAiChat()
    await chat.sendMessage('Apa itu perulangan?')

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body)
    expect(body.message).toBe('Apa itu perulangan?')
    expect(body.context.lessons.length).toBe(6)
    const last = chat.lastMessage.value!
    expect(last.content).toBe('Berdasarkan materi')
    expect(last.sources).toEqual([SRC])
  })

  it('handles a final event without trailing newline, and old servers (no sources event)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(sseResponse(['data: {"word":"Hai"}\n\n', `data: ${JSON.stringify({ sources: [SRC], done: true })}`])) as any
    const chat = useAiChat()
    await chat.sendMessage('x', {})
    expect(chat.lastMessage.value!.sources).toEqual([SRC])

    globalThis.fetch = vi.fn().mockResolvedValue(sseResponse(['data: {"word":"Hai"}\n\n'])) as any
    const chat2 = useAiChat()
    await chat2.sendMessage('x', {})
    expect(chat2.lastMessage.value!.content).toBe('Hai')
    expect(chat2.lastMessage.value!.sources).toBeUndefined()
  })

  it('reads sources from a JSON reply', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ reply: 'Jawaban', sources: [SRC] }),
    }) as any
    const chat = useAiChat()
    await chat.sendMessage('x', {})
    expect(chat.lastMessage.value!.sources).toEqual([SRC])
  })
})

describe('AiChat source chips', () => {
  async function chatWith(sources: unknown[], reply = 'Berdasarkan materi **Perulangan**: isi.') {
    await loginS1()
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ reply, sources }),
    }) as any
    const wrapper = mount(AiChat, { global: { stubs: { NuxtLink: NuxtLinkStub } } })
    await wrapper.find('textarea').setValue('Apa itu perulangan?')
    await wrapper.find('.btn-send').trigger('click')
    await flushPromises()
    return wrapper
  }

  it('renders a chip per source linking to the lesson page; excerpt on hover and on expand', async () => {
    const long = { ...SRC, lesson_id: 'l9', judul: 'Judul materi yang sangat panjang sekali '.repeat(4), excerpt: 'Kutipan <b>bukan html</b>' }
    const wrapper = await chatWith([SRC, long])
    const box = wrapper.find('[data-testid="chat-sources"]')
    expect(box.exists()).toBe(true)
    expect(box.text()).toContain('📖 Sumber:')
    const links = wrapper.findAll('[data-testid="chat-source-link"]')
    expect(links.length).toBe(2)
    expect(links[0]!.attributes('href')).toBe('/courses/c1/lessons/l4')
    expect(links[0]!.attributes('title')).toBe(SRC.excerpt)
    expect(links[0]!.text()).toContain('MK101')
    expect(links[0]!.text()).toContain('Perulangan (Looping)')

    // Expand the second excerpt: rendered as text, not HTML
    await wrapper.findAll('.source-toggle')[1]!.trigger('click')
    const excerpt = wrapper.find('[data-testid="chat-source-excerpt"]')
    expect(excerpt.text()).toContain('Kutipan <b>bukan html</b>')
    expect(excerpt.find('b').exists()).toBe(false)
    expect(wrapper.findAll('.source-toggle')[1]!.attributes('aria-expanded')).toBe('true')
    await wrapper.findAll('.source-toggle')[1]!.trigger('click')
    expect(wrapper.find('[data-testid="chat-source-excerpt"]').exists()).toBe(false)
  })

  it('shows no sources block for answers without sources', async () => {
    const wrapper = await chatWith([], 'Maaf, saya belum memiliki informasi tentang itu.')
    expect(wrapper.text()).toContain('Maaf, saya belum memiliki informasi')
    expect(wrapper.find('[data-testid="chat-sources"]').exists()).toBe(false)
  })

  it('lesson/model text with HTML is escaped in the message body', async () => {
    const wrapper = await chatWith([SRC], 'Materi: <img src=x onerror=alert(1)> selesai')
    expect(wrapper.find('.message-assistant img').exists()).toBe(false)
    expect(wrapper.find('.message-assistant .message-text').text()).toContain('<img src=x onerror=alert(1)>')
  })
})
