// @vitest-environment node
/**
 * POST /api/ai/chat — route tests over real HTTP (h3 app + node server).
 *
 * Demo mode (no key) and "real API" mode against a local stub of an
 * OpenAI-compatible server (/v1/chat/completions incl. streaming, /v1/embeddings).
 * Covers JSON + SSE framing, sources on both, fallbacks, and input validation.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createServer, type Server, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp, defineEventHandler, toNodeListener } from 'h3'
import { createPinia, setActivePinia } from 'pinia'
import { useCoursesStore } from '~/stores/courses'
import { useAuthStore } from '~/stores/auth'
import { localEmbedding, normalizeForEmbedding, UNTRUSTED_NOTICE } from '../../../server/utils/aiText'
import { stripStopwords, type RagLesson } from '../../../server/utils/rag'
import { getUsage } from '../../../server/utils/costTracker'

// Nitro macro / auto-import used by the route file.
;(globalThis as any).defineRouteMeta = () => {}

const baseRuntime = () => ({
  public: { supabaseUrl: 'https://example.supabase.co', demoMode: 'true', appName: 'LMS Mahasiswa' },
  supabaseServiceRoleKey: '',
})
let runtime: Record<string, unknown> = baseRuntime()
;(globalThis as any).useRuntimeConfig = () => runtime

// ── Stub OpenAI-compatible server ──
interface StubCall { path: string; body: any }
const stubCalls: StubCall[] = []
let stubMode: 'ok' | 'fail' = 'ok'
let stub: Server
let stubUrl = ''

function readJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data ? JSON.parse(data) : null))
  })
}

// ── App under test ──
let app: Server
let baseUrl = ''
let lessons: RagLesson[] = []

beforeAll(async () => {
  stub = createServer(async (req, res) => {
    const body = await readJson(req)
    stubCalls.push({ path: req.url || '', body })
    if (stubMode === 'fail') {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end('{"error":"down"}')
      return
    }
    if (req.url === '/v1/embeddings') {
      // "Semantic" stand-in: lexical vectors over topic words only.
      const data = body.input.map((t: string, index: number) => ({ index, embedding: localEmbedding(normalizeForEmbedding(stripStopwords(t)), 1536) }))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ data, usage: { prompt_tokens: 5, total_tokens: 5 } }))
      return
    }
    if (req.url === '/v1/chat/completions') {
      const system: string = body.messages[0].content
      const grounded = system.includes('<<<DATA:MATERI>>>')
      const answer = grounded ? 'Menurut materi Perulangan (Looping), for dipakai bila jumlah ulang diketahui.' : 'Materi belum membahasnya.'
      if (body.stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        const words = answer.split(/(?<=\s)/)
        for (const w of words) {
          const line = `data: ${JSON.stringify({ choices: [{ delta: { content: w } }] })}\n\n`
          // split each event across two writes to exercise buffering
          res.write(line.slice(0, 10))
          res.write(line.slice(10))
        }
        res.write(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 100, completion_tokens: 20 } })}\n\n`)
        res.end('data: [DONE]\n\n')
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ message: { content: answer } }], usage: { prompt_tokens: 50, completion_tokens: 10 } }))
      return
    }
    res.writeHead(404)
    res.end()
  })
  await new Promise<void>((r) => stub.listen(0, '127.0.0.1', () => r()))
  stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`

  const { default: handler } = await import('../../../server/api/ai/chat.post')
  const h3 = createApp()
  h3.use(defineEventHandler((event) => {
    event.context.session = { userId: 's1', role: 'student', name: 'Ahmad Fauzi' }
  }))
  h3.use('/api/ai/chat', handler)
  app = createServer(toNodeListener(h3))
  await new Promise<void>((r) => app.listen(0, '127.0.0.1', () => r()))
  baseUrl = `http://127.0.0.1:${(app.address() as AddressInfo).port}`

  // Demo lessons of student s1 (MK101 + MK102), exactly what the client sends.
  setActivePinia(createPinia())
  const courses = useCoursesStore()
  await courses.init()
  const auth = useAuthStore()
  auth.students = [{ id: 's1', nama: 'Ahmad Fauzi', npm: '20241001', kelas: '1A', level: 1, session_time: 'morning' }] as any
  await auth.loginAsStudent('Ahmad Fauzi', '20241001', 'mahasiswa123').catch(() => {})
  lessons = courses.getLessonsForAi()
})

afterAll(async () => {
  await new Promise((r) => app.close(r))
  await new Promise((r) => stub.close(r))
})

beforeEach(() => {
  runtime = baseRuntime()
  stubCalls.length = 0
  stubMode = 'ok'
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
})

const useApi = () => {
  runtime = { ...runtime, aiApiKey: 'test', aiBaseUrl: `${stubUrl}/v1`, aiModel: 'stub-model', aiEmbeddingModel: 'text-embedding-3-small' }
}

async function postJson(body: unknown) {
  const res = await fetch(`${baseUrl}/api/ai/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json() }
}

async function postStream(body: unknown) {
  const res = await fetch(`${baseUrl}/api/ai/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  const events = text
    .split('\n\n')
    .filter((e) => e.startsWith('data: '))
    .map((e) => JSON.parse(e.slice(6)))
  return { status: res.status, contentType: res.headers.get('content-type'), raw: text, events }
}

const words = (events: any[]) => events.filter((e) => typeof e.word === 'string').map((e) => e.word).join('')

describe('demo mode (no API key)', () => {
  it('JSON: extractive answer grounded in the right lesson, with structured sources', async () => {
    const { status, data } = await postJson({ message: 'Apa perbedaan for dan while?', context: { lessons } })
    expect(status).toBe(200)
    expect(data.reply).toMatch(/^Berdasarkan materi \*\*Perulangan \(Looping\)\*\* \(MK101\):/)
    expect(data.reply).toMatch(/while/)
    expect(data.sources[0]).toMatchObject({ lesson_id: 'l4', course_id: 'c1', course_kode: 'MK101', judul: 'Perulangan (Looping)' })
    expect(typeof data.sources[0].excerpt).toBe('string')
    expect(typeof data.sources[0].score).toBe('number')
    expect(new Set(data.sources.map((s: any) => s.lesson_id)).size).toBe(data.sources.length)
  })

  it('JSON: unrelated question ⇒ canned knowledge base, no sources', async () => {
    const { data } = await postJson({ message: 'Apa perbedaan SQL dan NoSQL?', context: { lessons } })
    expect(data.reply).toMatch(/Basis Data adalah/)
    expect(data.sources).toEqual([])
  })

  it('JSON: no context (old clients) still works', async () => {
    const { status, data } = await postJson({ message: 'Jelaskan perulangan for di Python' })
    expect(status).toBe(200)
    expect(data.reply).toMatch(/Perulangan digunakan/)
    expect(data.sources).toEqual([])
  })

  it('greeting skips retrieval', async () => {
    const { data } = await postJson({ message: 'Halo', context: { lessons } })
    expect(data.reply).toMatch(/^Halo!/)
    expect(data.sources).toEqual([])
  })

  it('SSE: words then one final sources event', async () => {
    const { status, contentType, events } = await postStream({ message: 'Apa itu fungsi bijektif?', context: { lessons } })
    expect(status).toBe(200)
    expect(contentType).toMatch(/text\/event-stream/)
    const last = events[events.length - 1]
    expect(last.done).toBe(true)
    expect(last.sources[0]).toMatchObject({ lesson_id: 'l6', judul: 'Relasi dan Fungsi' })
    expect(events.slice(0, -1).every((e) => typeof e.word === 'string')).toBe(true)
    expect(words(events)).toMatch(/^Berdasarkan materi \*\*Relasi dan Fungsi\*\*/)
  }, 20_000)

  it('SSE: unrelated question ends with empty sources', async () => {
    const { events } = await postStream({ message: 'Bagaimana cara memasak rendang yang enak?', context: { lessons } })
    expect(events[events.length - 1]).toEqual({ sources: [], done: true })
    expect(words(events)).toMatch(/Maaf, saya belum memiliki informasi/)
  }, 20_000)
})

describe('validation', () => {
  it('400 on empty / non-string / too long message', async () => {
    expect((await postJson({})).status).toBe(400)
    expect((await postJson({ message: 42 })).status).toBe(400)
    expect((await postJson({ message: 'x'.repeat(2001) })).status).toBe(400)
  })

  it('400 on too many context lessons', async () => {
    const many = Array.from({ length: 101 }, (_, i) => ({ id: `l${i}`, course_id: 'c1', konten: 'x' }))
    const { status, data } = await postJson({ message: 'Apa itu variabel?', context: { lessons: many } })
    expect(status).toBe(400)
    expect(data.statusMessage ?? data.message).toMatch(/terlalu banyak/)
  })

  it('ignores a malformed context instead of failing', async () => {
    const { status } = await postJson({ message: 'Apa itu variabel?', context: { lessons: 'bukan array', courses: 'x' } })
    expect(status).toBe(200)
  })
})

describe('API mode (stub OpenAI-compatible server)', () => {
  it('JSON: system prompt carries wrapped material + notice; reply + sources returned; usage recorded', async () => {
    useApi()
    const before = getUsage().totalTokens
    const { status, data } = await postJson({ message: 'Jelaskan perulangan for di Python', context: { lessons, courses: [{ kode: 'MK101', nama: 'Pemrograman Dasar' }] } })
    expect(status).toBe(200)
    expect(data.reply).toMatch(/^Menurut materi Perulangan/)
    expect(data.sources[0]).toMatchObject({ lesson_id: 'l4' })

    const embedCall = stubCalls.find((c) => c.path === '/v1/embeddings')!
    expect(embedCall.body.input.length).toBeGreaterThan(1) // question + chunks in one call
    const chat = stubCalls.find((c) => c.path === '/v1/chat/completions')!
    const system: string = chat.body.messages[0].content
    expect(system).toContain(UNTRUSTED_NOTICE)
    expect(system).toContain('Materi "Perulangan (Looping)" (MK101)')
    expect(system).toContain('asisten AI untuk LMS Mahasiswa')
    expect(system).toContain('MK101: Pemrograman Dasar')
    expect(chat.body.messages[1].content).toBe('Jelaskan perulangan for di Python')
    expect(getUsage().totalTokens).toBeGreaterThan(before)
  })

  it('JSON: second identical request re-embeds only the question (cache)', async () => {
    useApi()
    await postJson({ message: 'Apa itu irisan himpunan?', context: { lessons } })
    stubCalls.length = 0
    await postJson({ message: 'Apa itu irisan himpunan?', context: { lessons } })
    const embedCall = stubCalls.find((c) => c.path === '/v1/embeddings')!
    expect(embedCall.body.input).toEqual(['apa itu irisan himpunan?'])
  })

  it('SSE: relays upstream deltas (split across reads) and ends with sources; records real usage', async () => {
    useApi()
    const before = getUsage().totalTokens
    const { events } = await postStream({ message: 'Jelaskan perulangan for di Python', context: { lessons } })
    expect(words(events)).toBe('Menurut materi Perulangan (Looping), for dipakai bila jumlah ulang diketahui.')
    const last = events[events.length - 1]
    expect(last.done).toBe(true)
    expect(last.sources[0]).toMatchObject({ lesson_id: 'l4' })
    const chat = stubCalls.find((c) => c.path === '/v1/chat/completions')!
    expect(chat.body.stream).toBe(true)
    // 5 embedding tokens + 100/20 from the stream's usage event
    expect(getUsage().totalTokens - before).toBe(125)
  })

  it('model told "not covered" when nothing relevant; no sources', async () => {
    useApi()
    const { data } = await postJson({ message: 'Siapa presiden pertama Indonesia?', context: { lessons } })
    expect(data.reply).toBe('Materi belum membahasnya.')
    expect(data.sources).toEqual([])
    const system: string = stubCalls.find((c) => c.path === '/v1/chat/completions')!.body.messages[0].content
    expect(system).toMatch(/Tidak ditemukan materi kuliah yang relevan/)
  })

  it('upstream down ⇒ local embeddings + extractive fallback with sources (JSON and SSE)', async () => {
    useApi()
    stubMode = 'fail'
    const { status, data } = await postJson({ message: 'Apa itu fungsi bijektif?', context: { lessons } })
    expect(status).toBe(200)
    expect(data.reply).toMatch(/^Berdasarkan materi \*\*Relasi dan Fungsi\*\*/)
    expect(data.sources[0]).toMatchObject({ lesson_id: 'l6' })

    const s = await postStream({ message: 'Apa itu fungsi bijektif?', context: { lessons } })
    expect(words(s.events)).toMatch(/^Berdasarkan materi \*\*Relasi dan Fungsi\*\*/)
    expect(s.events[s.events.length - 1].sources[0]).toMatchObject({ lesson_id: 'l6' })
  })
})
