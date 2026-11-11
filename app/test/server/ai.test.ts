/**
 * AI Client — Unit Tests
 *
 * Tests the network-calling cores (chatCompletionWith, chatJsonWith,
 * embedTextsWith) with a mocked fetch, plus config resolution and role checks.
 * No real API is contacted.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  AiUnavailableError,
  isAiUnavailable,
  resolveAiConfig,
  getAiConfig,
  requireAiRole,
  chatCompletionWith,
  chatJsonWith,
  embedTextsWith,
  EMBEDDING_DIMS,
  EMBED_BATCH_SIZE,
  MAX_EMBED_TEXTS,
  type AiConfig,
  type FetchLike,
} from '../../../server/utils/ai'
import { getUsage } from '../../../server/utils/costTracker'
import { localEmbedding } from '../../../server/utils/aiText'

const LIVE: AiConfig = {
  apiKey: 'sk-test',
  model: 'gpt-test',
  embeddingModel: 'text-embedding-3-small',
  baseUrl: 'https://llm.example/v1',
  isDemo: false,
}
const DEMO: AiConfig = { ...LIVE, apiKey: '', isDemo: true }

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const chatReply = (content: string | null, usage: Record<string, number> | null = { prompt_tokens: 11, completion_tokens: 7 }) =>
  jsonResponse({ choices: [{ message: { content } }], ...(usage ? { usage } : {}) })

/** Build a deterministic fake embedding vector for a text. */
const fakeVec = (seed: number) => Array.from({ length: EMBEDDING_DIMS }, (_, i) => ((i + seed) % 7) / 7)

/** A fetch mock answering /embeddings like OpenAI (respects input order via `index`). */
function embeddingsFetch(opts: { failOnCall?: number; reverse?: boolean } = {}) {
  let call = 0
  return vi.fn<FetchLike>(async (_url, init) => {
    call++
    if (opts.failOnCall === call) return new Response('boom', { status: 500 })
    const body = JSON.parse(String(init?.body))
    let data = (body.input as string[]).map((t, index) => ({ index, embedding: fakeVec(t.length) }))
    if (opts.reverse) data = data.reverse()
    return jsonResponse({ data, usage: { prompt_tokens: body.input.length * 3, total_tokens: body.input.length * 3 } })
  })
}

let deps: { isOverBudget: ReturnType<typeof vi.fn>; recordUsage: ReturnType<typeof vi.fn> }
beforeEach(() => {
  deps = { isOverBudget: vi.fn(() => false), recordUsage: vi.fn() }
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

// ────────────────────────────────────────────
describe('resolveAiConfig / getAiConfig', () => {
  it('applies defaults and demo flag when no key', () => {
    expect(resolveAiConfig({})).toEqual({
      apiKey: '',
      model: 'gpt-4o-mini',
      embeddingModel: 'text-embedding-3-small',
      baseUrl: 'https://api.openai.com/v1',
      isDemo: true,
    })
  })

  it('reads values, trims key and strips trailing slashes', () => {
    const c = resolveAiConfig({ aiApiKey: ' sk-1 ', aiModel: 'm', aiEmbeddingModel: 'e', aiBaseUrl: 'http://x/v1//' })
    expect(c).toEqual({ apiKey: 'sk-1', model: 'm', embeddingModel: 'e', baseUrl: 'http://x/v1', isDemo: false })
    expect(resolveAiConfig({ aiApiKey: '   ' }).isDemo).toBe(true)
  })

  it('getAiConfig reads useRuntimeConfig', () => {
    const original = (globalThis as any).useRuntimeConfig
    ;(globalThis as any).useRuntimeConfig = vi.fn(() => ({ aiApiKey: 'k', aiBaseUrl: 'https://b/v1/' }))
    try {
      expect(getAiConfig()).toMatchObject({ apiKey: 'k', baseUrl: 'https://b/v1', isDemo: false })
    } finally {
      ;(globalThis as any).useRuntimeConfig = original
    }
  })
})

describe('AiUnavailableError / isAiUnavailable', () => {
  it('carries reason and status', () => {
    const e = new AiUnavailableError('upstream', 'x', 502)
    expect(e).toBeInstanceOf(Error)
    expect(e.reason).toBe('upstream')
    expect(e.status).toBe(502)
    expect(isAiUnavailable(e)).toBe(true)
  })

  it('rejects other errors and non-errors', () => {
    expect(isAiUnavailable(new Error('x'))).toBe(false)
    expect(isAiUnavailable(null)).toBe(false)
    expect(isAiUnavailable({ name: 'AiUnavailableError' })).toBe(true) // duck-typed across module copies
  })
})

describe('requireAiRole', () => {
  const ev = (session?: unknown) => ({ context: { session }, node: { req: { headers: {} } } }) as any

  it('returns the session when the role is allowed', () => {
    const s = { userId: 'u1', role: 'instructor', name: 'Bu Dosen' }
    expect(requireAiRole(ev(s), ['instructor', 'admin'])).toBe(s)
  })

  it('throws 403 for a disallowed role', () => {
    try {
      requireAiRole(ev({ userId: 'u2', role: 'student', name: 'Mhs' }), ['instructor'])
      expect.unreachable()
    } catch (err: any) {
      expect(err.statusCode).toBe(403)
      expect(err.statusMessage).toMatch(/Akses ditolak/)
    }
  })

  it('throws 401 when there is no session and no cookie', () => {
    try {
      requireAiRole(ev(undefined), ['student'])
      expect.unreachable()
    } catch (err: any) {
      expect(err.statusCode).toBe(401)
      expect(err.statusMessage).toMatch(/login/)
    }
  })
})

// ────────────────────────────────────────────
describe('chatCompletionWith', () => {
  it('posts to /chat/completions and returns content + usage', async () => {
    const fetch = vi.fn<FetchLike>(async () => chatReply('Halo!'))
    const r = await chatCompletionWith(LIVE, { system: 'sys', user: 'hai' }, { ...deps, fetch })
    expect(r).toEqual({ content: 'Halo!', promptTokens: 11, completionTokens: 7 })

    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://llm.example/v1/chat/completions')
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
    expect(init!.signal).toBeInstanceOf(AbortSignal)
    const body = JSON.parse(String(init!.body))
    expect(body).toMatchObject({
      model: 'gpt-test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hai' },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    })
    expect(body.response_format).toBeUndefined()
    expect(deps.recordUsage).toHaveBeenCalledWith(11, 7)
  })

  it('uses json_object mode and ensures the word JSON is present', async () => {
    const fetch = vi.fn<FetchLike>(async () => chatReply('{"a":1}'))
    await chatCompletionWith(LIVE, { system: 'Nilai tugas', user: 'x', json: true, temperature: 0, maxTokens: 50 }, { ...deps, fetch })
    const body = JSON.parse(String(fetch.mock.calls[0]![1]!.body))
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.temperature).toBe(0)
    expect(body.max_tokens).toBe(50)
    expect(body.messages[0].content).toMatch(/JSON/)
  })

  it('estimates usage when the API omits it', async () => {
    const fetch = vi.fn<FetchLike>(async () => chatReply('12345678', null))
    const r = await chatCompletionWith(LIVE, { system: 'abcd', user: 'efgh' }, { ...deps, fetch })
    expect(r.promptTokens).toBe(2)
    expect(r.completionTokens).toBe(2)
    expect(deps.recordUsage).toHaveBeenCalledWith(2, 2)
  })

  it('demo mode ⇒ AiUnavailableError("demo") without calling fetch', async () => {
    const fetch = vi.fn<FetchLike>()
    await expect(chatCompletionWith(DEMO, { system: 's', user: 'u' }, { ...deps, fetch })).rejects.toMatchObject({
      name: 'AiUnavailableError',
      reason: 'demo',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('over budget ⇒ 429 H3 error (not AiUnavailableError), no fetch', async () => {
    const fetch = vi.fn<FetchLike>()
    deps.isOverBudget.mockReturnValue(true)
    const err = await chatCompletionWith(LIVE, { system: 's', user: 'u' }, { ...deps, fetch }).catch((e) => e)
    expect(err.statusCode).toBe(429)
    expect(err.statusMessage).toMatch(/Batas harian/)
    expect(isAiUnavailable(err)).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('non-200 ⇒ AiUnavailableError("upstream") with status, no usage recorded', async () => {
    const fetch = vi.fn<FetchLike>(async () => new Response('rate limited', { status: 503 }))
    const err = await chatCompletionWith(LIVE, { system: 's', user: 'u' }, { ...deps, fetch }).catch((e) => e)
    expect(isAiUnavailable(err)).toBe(true)
    expect(err.reason).toBe('upstream')
    expect(err.status).toBe(503)
    expect(err.message).toContain('rate limited')
    expect(deps.recordUsage).not.toHaveBeenCalled()
  })

  it('network error ⇒ AiUnavailableError("upstream")', async () => {
    const fetch = vi.fn<FetchLike>(async () => {
      throw new TypeError('fetch failed')
    })
    await expect(chatCompletionWith(LIVE, { system: 's', user: 'u' }, { ...deps, fetch })).rejects.toMatchObject({
      reason: 'upstream',
    })
  })

  it('timeout aborts the request ⇒ AiUnavailableError("timeout")', async () => {
    let aborted = false
    const fetch = vi.fn<FetchLike>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener('abort', () => {
            aborted = true
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }),
    )
    const err = await chatCompletionWith(LIVE, { system: 's', user: 'u', timeoutMs: 20 }, { ...deps, fetch }).catch((e) => e)
    expect(aborted).toBe(true)
    expect(err.reason).toBe('timeout')
  })

  it('empty reply ⇒ AiUnavailableError("invalid_response") but usage still recorded', async () => {
    const fetch = vi.fn<FetchLike>(async () => chatReply('   '))
    await expect(chatCompletionWith(LIVE, { system: 's', user: 'u' }, { ...deps, fetch })).rejects.toMatchObject({
      reason: 'invalid_response',
    })
    expect(deps.recordUsage).toHaveBeenCalledWith(11, 7)
  })

  it('non-JSON 200 body ⇒ AiUnavailableError("invalid_response")', async () => {
    const fetch = vi.fn<FetchLike>(async () => new Response('<html>proxy</html>', { status: 200 }))
    await expect(chatCompletionWith(LIVE, { system: 's', user: 'u' }, { ...deps, fetch })).rejects.toMatchObject({
      reason: 'invalid_response',
    })
  })

  it('records into the real costTracker by default', async () => {
    const before = getUsage().totalTokens
    const fetch = vi.fn<FetchLike>(async () => chatReply('ok', { prompt_tokens: 5, completion_tokens: 3 }))
    await chatCompletionWith(LIVE, { system: 's', user: 'u' }, { fetch })
    expect(getUsage().totalTokens - before).toBe(8)
  })
})

describe('chatJsonWith', () => {
  const validate = (raw: unknown) => {
    const r = raw as { score?: unknown }
    return typeof r?.score === 'number' ? { score: Math.min(100, Math.max(0, r.score)) } : null
  }

  it('extracts, validates and coerces the JSON reply', async () => {
    const fetch = vi.fn<FetchLike>(async () => chatReply('Hasil:\n```json\n{"score": 120}\n```'))
    await expect(chatJsonWith(LIVE, { system: 's', user: 'u' }, validate, { ...deps, fetch })).resolves.toEqual({ score: 100 })
    expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body)).response_format).toEqual({ type: 'json_object' })
  })

  it('invalid shape or unparseable reply ⇒ AiUnavailableError("invalid_response")', async () => {
    for (const reply of ['{"nilai": 80}', 'maaf, tidak bisa']) {
      const fetch = vi.fn<FetchLike>(async () => chatReply(reply))
      await expect(chatJsonWith(LIVE, { system: 's', user: 'u' }, validate, { ...deps, fetch })).rejects.toMatchObject({
        reason: 'invalid_response',
      })
    }
  })

  it('propagates demo mode', async () => {
    await expect(chatJsonWith(DEMO, { system: 's', user: 'u' }, validate, deps)).rejects.toMatchObject({ reason: 'demo' })
  })
})

// ────────────────────────────────────────────
describe('embedTextsWith', () => {
  it('api mode: posts model/input/dimensions, keeps order, records usage', async () => {
    const fetch = embeddingsFetch({ reverse: true })
    const r = await embedTextsWith(LIVE, ['satu', 'dua tiga', 'empat lima enam'], { ...deps, fetch })
    expect(r.mode).toBe('api')
    expect(r.dims).toBe(EMBEDDING_DIMS)
    expect(r.vectors).toEqual([fakeVec(4), fakeVec(8), fakeVec(15)])

    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://llm.example/v1/embeddings')
    expect(JSON.parse(String(init!.body))).toEqual({
      model: 'text-embedding-3-small',
      input: ['satu', 'dua tiga', 'empat lima enam'],
      dimensions: 1536,
    })
    expect(deps.recordUsage).toHaveBeenCalledWith(9, 0)
  })

  it('normalises and truncates input; empty texts get zero vectors and are not sent', async () => {
    const fetch = embeddingsFetch()
    const r = await embedTextsWith(LIVE, ['**Halo**', '   ', 'x'.repeat(20_000)], { ...deps, fetch })
    const sent = JSON.parse(String(fetch.mock.calls[0]![1]!.body)).input as string[]
    expect(sent).toEqual(['halo', 'x'.repeat(8000)])
    expect(r.mode).toBe('api')
    expect(r.vectors[1]!.every((v) => v === 0)).toBe(true)
    expect(r.vectors[0]).toEqual(fakeVec(4))
  })

  it('omits `dimensions` for non text-embedding-3 models', async () => {
    const fetch = embeddingsFetch()
    await embedTextsWith({ ...LIVE, embeddingModel: 'text-embedding-ada-002' }, ['a'], { ...deps, fetch })
    expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body)).dimensions).toBeUndefined()
  })

  it('splits large inputs into sub-batches', async () => {
    const fetch = embeddingsFetch()
    const texts = Array.from({ length: EMBED_BATCH_SIZE * 2 + 5 }, (_, i) => `teks ${i}`)
    const r = await embedTextsWith(LIVE, texts, { ...deps, fetch })
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(r.vectors).toHaveLength(texts.length)
    expect(r.vectors[texts.length - 1]).toEqual(fakeVec(`teks ${texts.length - 1}`.length))
    expect(deps.recordUsage).toHaveBeenCalledTimes(3)
  })

  it('demo mode: local embeddings for the whole batch, no fetch', async () => {
    const fetch = vi.fn<FetchLike>()
    const r = await embedTextsWith(DEMO, ['Variabel Python', 'perulangan for'], { ...deps, fetch })
    expect(fetch).not.toHaveBeenCalled()
    expect(r.mode).toBe('local')
    expect(r.dims).toBe(EMBEDDING_DIMS)
    expect(r.vectors[0]).toEqual(localEmbedding('variabel python', EMBEDDING_DIMS))
  })

  it('API failure in a later sub-batch ⇒ WHOLE batch falls back to local (no mixed modes)', async () => {
    const fetch = embeddingsFetch({ failOnCall: 2 })
    const texts = Array.from({ length: EMBED_BATCH_SIZE + 3 }, (_, i) => `materi ${i}`)
    const r = await embedTextsWith(LIVE, texts, { ...deps, fetch })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(r.mode).toBe('local')
    expect(r.vectors).toHaveLength(texts.length)
    // the first sub-batch succeeded upstream, but its API vectors must be discarded
    expect(r.vectors[0]).toEqual(localEmbedding('materi 0', EMBEDDING_DIMS))
    expect(r.vectors[texts.length - 1]).toEqual(localEmbedding(`materi ${texts.length - 1}`, EMBEDDING_DIMS))
    // tokens actually spent on the successful sub-batch are still recorded
    expect(deps.recordUsage).toHaveBeenCalledTimes(1)
  })

  it('malformed API vectors (wrong length / count) ⇒ local fallback', async () => {
    const wrongDims = vi.fn<FetchLike>(async () => jsonResponse({ data: [{ index: 0, embedding: [0.1, 0.2] }] }))
    expect((await embedTextsWith(LIVE, ['a'], { ...deps, fetch: wrongDims })).mode).toBe('local')
    const wrongCount = vi.fn<FetchLike>(async () => jsonResponse({ data: [] }))
    expect((await embedTextsWith(LIVE, ['a'], { ...deps, fetch: wrongCount })).mode).toBe('local')
  })

  it('timeout ⇒ local fallback', async () => {
    const fetch = vi.fn<FetchLike>(
      (_url, init) =>
        new Promise((_res, reject) => init!.signal!.addEventListener('abort', () => reject(new Error('aborted')))),
    )
    const r = await embedTextsWith(LIVE, ['a'], { ...deps, fetch, timeoutMs: 20 })
    expect(r.mode).toBe('local')
  })

  it('over budget ⇒ 429, too many texts ⇒ 400', async () => {
    deps.isOverBudget.mockReturnValue(true)
    const e429 = await embedTextsWith(LIVE, ['a'], { ...deps, fetch: vi.fn<FetchLike>() }).catch((e) => e)
    expect(e429.statusCode).toBe(429)
    const e400 = await embedTextsWith(LIVE, new Array(MAX_EMBED_TEXTS + 1).fill('a'), deps).catch((e) => e)
    expect(e400.statusCode).toBe(400)
  })

  it('empty list returns no vectors without calling fetch', async () => {
    const fetch = vi.fn<FetchLike>()
    expect(await embedTextsWith(LIVE, [], { ...deps, fetch })).toEqual({ vectors: [], mode: 'api', dims: EMBEDDING_DIMS })
    expect(fetch).not.toHaveBeenCalled()
  })
})
