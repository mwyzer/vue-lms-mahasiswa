/**
 * POST /api/plagiarism/check — route-level tests.
 *
 * The handler is imported with the Nitro auto-imports stubbed as globals and
 * `embedTexts` mocked (no network). Covers auth, the response contract, the
 * budget-exhausted path, payload guards and the per-user rate limit.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { createError } from 'h3'
import { createSessionCookie, parseSessionCookie } from '../../../server/utils/session'
import { embedTextsWith, type AiConfig } from '../../../server/utils/ai'
import { FIXTURE_SUBMISSIONS } from './plagiarism.fixture'

vi.mock('../../../server/utils/ai', async (orig) => {
  const actual = await orig<typeof import('../../../server/utils/ai')>()
  return {
    ...actual,
    embedTexts: vi.fn(),
    getAiConfig: vi.fn(() => actual.resolveAiConfig({})),
  }
})
const ai = await import('../../../server/utils/ai')

const DEMO: AiConfig = { apiKey: '', model: 'm', embeddingModel: 'text-embedding-3-small', baseUrl: 'http://x/v1', isDemo: true }
const LIVE: AiConfig = { ...DEMO, apiKey: 'k', isDemo: false }

interface FakeEvent {
  cookies: Record<string, string>
  body: unknown
  headers: Record<string, string>
}

let handler: (e: FakeEvent) => Promise<any>
let userSeq = 0

beforeAll(async () => {
  vi.stubGlobal('defineRouteMeta', () => {})
  vi.stubGlobal('defineEventHandler', (h: unknown) => h)
  vi.stubGlobal('getCookie', (e: FakeEvent, name: string) => e.cookies[name])
  vi.stubGlobal('parseSessionCookie', parseSessionCookie)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('readBody', async (e: FakeEvent) => e.body)
  vi.stubGlobal('setResponseHeader', (e: FakeEvent, k: string, v: string) => {
    e.headers[k] = v
  })
  handler = (await import('../../../server/api/plagiarism/check.post')).default as any
})

beforeEach(() => {
  vi.mocked(ai.embedTexts).mockReset()
  vi.mocked(ai.embedTexts).mockImplementation((_e, texts) => embedTextsWith(DEMO, texts))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

function event(body: unknown, role: 'student' | 'instructor' | 'admin' | null = 'instructor', userId?: string): FakeEvent {
  const cookies: Record<string, string> = {}
  if (role) cookies.lms_session = createSessionCookie({ userId: userId ?? `u${++userSeq}`, role, name: 'Dr. Test' })
  return { cookies, body, headers: {} }
}

describe('POST /api/plagiarism/check', () => {
  it('requires a session (401) and the instructor/admin role (403)', async () => {
    await expect(handler(event({ submissions: FIXTURE_SUBMISSIONS }, null))).rejects.toMatchObject({ statusCode: 401 })
    await expect(handler(event({ submissions: FIXTURE_SUBMISSIONS }, 'student'))).rejects.toMatchObject({ statusCode: 403 })
    expect(ai.embedTexts).not.toHaveBeenCalled()
  })

  it('demo (no key): embeds the eligible answers once and reports mode "local" with a note', async () => {
    const r = await handler(event({ submissions: FIXTURE_SUBMISSIONS }))
    expect(ai.embedTexts).toHaveBeenCalledTimes(1)
    expect(vi.mocked(ai.embedTexts).mock.calls[0]![1]).toHaveLength(5)
    expect(r).toMatchObject({ threshold: 75, total: 5 })
    expect(Array.isArray(r.checked) && Array.isArray(r.flagged) && Array.isArray(r.pairs)).toBe(true)
    expect(r.semantic).toMatchObject({ mode: 'local', threshold: 70, compared: 5 })
    expect(r.semantic.note).toMatch(/aproksimasi offline/)
    expect(r.pairs).toHaveLength(1)
    expect(r.pairs[0]).toMatchObject({ similarity: 71, semantic_similarity: 96, match_type: 'semantic' })
  })

  it('over the daily budget: still returns the lexical result, semantic "unavailable" with the reason', async () => {
    vi.mocked(ai.embedTexts).mockImplementation((_e, texts) =>
      embedTextsWith(LIVE, texts, { isOverBudget: () => true }),
    )
    const r = await handler(event({ submissions: FIXTURE_SUBMISSIONS, thresholds: { lexical: 70 } }))
    expect(r.semantic).toMatchObject({ mode: 'unavailable', reason: 'budget', threshold: null })
    expect(r.semantic.note).toMatch(/batas harian/i)
    expect(r.threshold).toBe(70)
    expect(r.pairs).toEqual([
      expect.objectContaining({ similarity: 71, semantic_similarity: null, match_type: 'lexical', semantic_skipped: 'unavailable' }),
    ])
  })

  it('unexpected embedding error ⇒ "unavailable" / "error", lexical still returned', async () => {
    vi.mocked(ai.embedTexts).mockRejectedValue(new Error('kaput'))
    const r = await handler(event({ submissions: FIXTURE_SUBMISSIONS }))
    expect(r.semantic).toMatchObject({ mode: 'unavailable', reason: 'error' })
    expect(r.total).toBe(5)
  })

  it('does not call the embedder when fewer than 2 answers are long enough', async () => {
    const subs = [
      { id: 'a', student_id: 'a', jawaban: 'print("Hello, World!")' },
      { id: 'b', student_id: 'b', jawaban: 'print("Hello World")' },
    ]
    const r = await handler(event({ submissions: subs }))
    expect(ai.embedTexts).not.toHaveBeenCalled()
    expect(r.semantic).toMatchObject({ mode: 'local', compared: 0, skipped_short: 2 })
    expect(r.total).toBe(2)
  })

  it('keeps the legacy early-exit shape for < 2 text answers', async () => {
    const r = await handler(event({ submissions: [{ id: 'a', student_id: 'a', jawaban: 'x' }, { id: 'b', student_id: 'b', jawaban: '  ' }] }))
    expect(r).toMatchObject({ checked: [], flagged: [], pairs: [], threshold: 75, total: 1 })
  })

  it('ignores malformed / duplicate entries and caps the batch size', async () => {
    const r = await handler(
      event({ submissions: [null, { id: 7 }, FIXTURE_SUBMISSIONS[0], FIXTURE_SUBMISSIONS[0], FIXTURE_SUBMISSIONS[1]] }),
    )
    expect(r.total).toBe(2)
    const many = Array.from({ length: 201 }, (_, i) => ({ id: `s${i}`, student_id: `s${i}`, jawaban: `jawaban ${i}` }))
    await expect(handler(event({ submissions: many }))).rejects.toMatchObject({ statusCode: 400 })
    const huge = [{ id: 'h', student_id: 'h', jawaban: 'a'.repeat(50_001) }, FIXTURE_SUBMISSIONS[0]]
    await expect(handler(event({ submissions: huge }))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rate-limits per user (10 checks / minute) with retry-after', async () => {
    const body = { submissions: FIXTURE_SUBMISSIONS.slice(0, 2) }
    for (let i = 0; i < 10; i++) await handler(event(body, 'instructor', 'rl-user'))
    const e = event(body, 'instructor', 'rl-user')
    await expect(handler(e)).rejects.toMatchObject({ statusCode: 429 })
    expect(Number(e.headers['retry-after'])).toBeGreaterThan(0)
    // Other instructors are unaffected.
    await expect(handler(event(body, 'instructor', 'rl-other'))).resolves.toBeTruthy()
  })
})
