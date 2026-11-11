/**
 * AI Client — Shared server-side LLM + embedding client for all AI features.
 *
 * Wraps an OpenAI-compatible API (`/chat/completions`, `/embeddings`) with:
 *   - config from runtimeConfig (`aiApiKey`, `aiModel`, `aiEmbeddingModel`, `aiBaseUrl`)
 *   - daily token budget (costTracker): checked before, recorded after each call
 *   - request timeouts (AbortController)
 *   - a typed `AiUnavailableError` for demo mode / upstream failure, so callers
 *     can fall back to a deterministic implementation
 *   - local (offline) embeddings when there is no API key or the API fails
 *
 * Layering: `chatCompletionWith` / `embedTextsWith` are the testable cores
 * (explicit config + injectable fetch/budget). `chatCompletion`, `chatJson` and
 * `embedTexts` are the event-taking wrappers API routes should use.
 * Pure text helpers live in `./aiText` (no Nitro globals).
 */
import { createError, getCookie, type H3Event } from 'h3'
import { getUsage, isOverBudget, recordUsage } from './costTracker'
import { parseSessionCookie, type SessionData } from './session'
import { extractJson, localEmbedding, normalizeForEmbedding } from './aiText'

// ────────────────────────────────────────────
// Constants & types
// ────────────────────────────────────────────

/** Vector length used everywhere (matches `lesson_chunks.embedding vector(1536)`). */
export const EMBEDDING_DIMS = 1536
/** Max texts per upstream `/embeddings` request (larger inputs are split into sub-batches). */
export const EMBED_BATCH_SIZE = 100
/** Max texts accepted by one `embedTexts` call. */
export const MAX_EMBED_TEXTS = 500
/** Each text is truncated to this many characters before embedding (~2k tokens, well under the 8k model limit). */
export const MAX_EMBED_INPUT_CHARS = 8000
/** Default timeout for chat completions. */
export const CHAT_TIMEOUT_MS = 30_000
/** Default timeout for one embeddings request. */
export const EMBED_TIMEOUT_MS = 20_000

/** Resolved AI configuration. */
export interface AiConfig {
  apiKey: string
  model: string
  embeddingModel: string
  /** Without trailing slash, e.g. `https://api.openai.com/v1`. */
  baseUrl: string
  /** True when there is no API key ⇒ callers must use their deterministic fallback. */
  isDemo: boolean
}

/** Why the AI is unavailable. */
export type AiUnavailableReason = 'demo' | 'upstream' | 'timeout' | 'invalid_response'

/**
 * Thrown when a real LLM answer cannot be obtained: demo mode (no API key),
 * network/HTTP error, timeout, or an unusable/invalid reply.
 * Callers should catch it (see {@link isAiUnavailable}) and fall back.
 * Note: the daily budget being exhausted is NOT this error — it is an
 * H3 429 error meant to reach the client.
 */
export class AiUnavailableError extends Error {
  readonly reason: AiUnavailableReason
  /** Upstream HTTP status, when the failure was a non-2xx response. */
  readonly status?: number

  constructor(reason: AiUnavailableReason, message: string, status?: number) {
    super(message)
    this.name = 'AiUnavailableError'
    this.reason = reason
    this.status = status
  }
}

/** Type guard for {@link AiUnavailableError} (also works across module copies). */
export function isAiUnavailable(err: unknown): err is AiUnavailableError {
  return err instanceof AiUnavailableError || (err as { name?: unknown } | null)?.name === 'AiUnavailableError'
}

/** Options for a chat completion. */
export interface ChatOptions {
  system: string
  user: string
  /** Default 0.3 (features here want consistent, factual output). */
  temperature?: number
  /** Default 1024. */
  maxTokens?: number
  /** Request `response_format: { type: 'json_object' }`. */
  json?: boolean
  /** Override the request timeout (default {@link CHAT_TIMEOUT_MS}). */
  timeoutMs?: number
}

/** Result of a chat completion. */
export interface ChatResult {
  content: string
  promptTokens: number
  completionTokens: number
}

/** Result of {@link embedTexts}. All vectors in one result share the same mode and length. */
export interface EmbedResult {
  vectors: number[][]
  mode: 'api' | 'local'
  dims: number
}

/** Minimal fetch signature (lets tests inject a mock). */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/** Injectable side effects for the cores. Defaults: global fetch + costTracker. */
export interface AiDeps {
  fetch?: FetchLike
  isOverBudget?: () => boolean
  recordUsage?: (promptTokens: number, completionTokens: number) => unknown
  timeoutMs?: number
}

// ────────────────────────────────────────────
// Config & auth
// ────────────────────────────────────────────

/** Build an {@link AiConfig} from a raw runtimeConfig-like object (pure; exported for tests). */
export function resolveAiConfig(raw: Record<string, unknown>): AiConfig {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const apiKey = str(raw.aiApiKey)
  return {
    apiKey,
    model: str(raw.aiModel) || 'gpt-4o-mini',
    embeddingModel: str(raw.aiEmbeddingModel) || 'text-embedding-3-small',
    baseUrl: (str(raw.aiBaseUrl) || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    isDemo: !apiKey,
  }
}

/** AI configuration from runtimeConfig. `isDemo` is true when `NUXT_AI_API_KEY` is empty. */
export function getAiConfig(event?: H3Event): AiConfig {
  return resolveAiConfig(useRuntimeConfig(event) as unknown as Record<string, unknown>)
}

/**
 * Require a logged-in user with one of `roles`. Returns the session.
 * Uses `event.context.session` (set by `01.ai-safeguard` for /api/ai/*), else
 * parses the `lms_session` cookie, so it also works on routes outside /api/ai.
 *
 * @throws H3Error 401 when not logged in, 403 when the role is not allowed
 * @example const session = requireAiRole(event, ['instructor', 'admin'])
 */
export function requireAiRole(event: H3Event, roles: ReadonlyArray<SessionData['role']>): SessionData {
  const session =
    (event.context?.session as SessionData | undefined) ?? parseSessionCookie(getCookie(event, 'lms_session'))
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized — silakan login terlebih dahulu' })
  }
  if (!roles.includes(session.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Akses ditolak — fitur ini hanya untuk ${roles.join('/')}.`,
    })
  }
  return session
}

// ────────────────────────────────────────────
// Internals
// ────────────────────────────────────────────

function budgetError() {
  const usage = getUsage()
  console.warn(`[CostTracker] Daily budget exceeded: ${usage.totalTokens} tokens used`)
  return createError({
    statusCode: 429,
    statusMessage: 'Batas harian penggunaan AI telah tercapai. Coba lagi besok.',
  })
}

/** POST JSON with a timeout. Maps network errors/timeouts/non-2xx to AiUnavailableError. */
async function postJson(
  doFetch: FetchLike,
  url: string,
  apiKey: string,
  body: unknown,
  timeoutMs: number,
): Promise<any> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  try {
    let res: Response
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err: any) {
      if (timedOut) throw new AiUnavailableError('timeout', `AI request timed out after ${timeoutMs} ms`)
      throw new AiUnavailableError('upstream', `AI request failed: ${err?.message ?? err}`)
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new AiUnavailableError('upstream', `AI API error ${res.status}: ${text.slice(0, 300)}`, res.status)
    }
    try {
      return await res.json()
    } catch {
      if (timedOut) throw new AiUnavailableError('timeout', `AI request timed out after ${timeoutMs} ms`)
      throw new AiUnavailableError('invalid_response', 'AI API returned non-JSON body')
    }
  } finally {
    clearTimeout(timer)
  }
}

const estimateTokens = (s: string) => Math.ceil(s.length / 4)

// ────────────────────────────────────────────
// Chat completions
// ────────────────────────────────────────────

/**
 * Testable core of {@link chatCompletion}: explicit config, injectable fetch/budget.
 * Order: demo ⇒ AiUnavailableError('demo'); over budget ⇒ H3 429; call; record usage.
 */
export async function chatCompletionWith(config: AiConfig, opts: ChatOptions, deps: AiDeps = {}): Promise<ChatResult> {
  if (config.isDemo) throw new AiUnavailableError('demo', 'AI API key tidak diset (mode demo)')
  if ((deps.isOverBudget ?? isOverBudget)()) throw budgetError()

  let system = opts.system
  // OpenAI rejects json_object mode unless the word "JSON" appears in the messages.
  if (opts.json && !/json/i.test(`${opts.system}\n${opts.user}`)) {
    system += '\n\nBalas hanya dengan satu objek JSON yang valid.'
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: opts.user },
    ],
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1024,
  }
  if (opts.json) body.response_format = { type: 'json_object' }

  const data = await postJson(
    deps.fetch ?? ((input, init) => fetch(input, init)),
    `${config.baseUrl}/chat/completions`,
    config.apiKey,
    body,
    opts.timeoutMs ?? deps.timeoutMs ?? CHAT_TIMEOUT_MS,
  )

  const content = data?.choices?.[0]?.message?.content
  const promptTokens = Number(data?.usage?.prompt_tokens ?? estimateTokens(system + opts.user))
  const completionTokens = Number(
    data?.usage?.completion_tokens ?? estimateTokens(typeof content === 'string' ? content : ''),
  )
  // Tokens were spent even if the reply turns out to be unusable.
  ;(deps.recordUsage ?? recordUsage)(promptTokens, completionTokens)

  if (typeof content !== 'string' || !content.trim()) {
    throw new AiUnavailableError('invalid_response', 'AI API returned an empty reply')
  }
  return { content, promptTokens, completionTokens }
}

/**
 * Call the chat model once.
 *
 * @throws AiUnavailableError in demo mode, on network/HTTP error, timeout or empty reply — fall back on it
 * @throws H3Error 429 when the daily token budget is exhausted — let it propagate
 * @example
 * try {
 *   const { content } = await chatCompletion(event, { system: `... ${UNTRUSTED_NOTICE}`, user: wrapUntrusted('PERTANYAAN', q) })
 * } catch (err) {
 *   if (!isAiUnavailable(err)) throw err
 *   // deterministic fallback
 * }
 */
export function chatCompletion(event: H3Event, opts: ChatOptions): Promise<ChatResult> {
  return chatCompletionWith(getAiConfig(event), opts)
}

/** Testable core of {@link chatJson}. */
export async function chatJsonWith<T>(
  config: AiConfig,
  opts: ChatOptions,
  validate: (raw: unknown) => T | null,
  deps: AiDeps = {},
): Promise<T> {
  const { content } = await chatCompletionWith(config, { ...opts, json: true }, deps)
  const raw = extractJson(content)
  const value = raw === null ? null : validate(raw)
  if (value === null || value === undefined) {
    throw new AiUnavailableError('invalid_response', 'AI reply did not match the expected JSON shape')
  }
  return value
}

/**
 * Call the chat model in JSON mode and validate the reply.
 * `validate` receives the parsed JSON and must return the typed value, or `null` if invalid
 * (it may also coerce/clean, e.g. clamp scores).
 *
 * @throws AiUnavailableError (incl. reason 'invalid_response' when validation fails)
 * @throws H3Error 429 when over budget
 */
export function chatJson<T>(event: H3Event, opts: ChatOptions, validate: (raw: unknown) => T | null): Promise<T> {
  return chatJsonWith(getAiConfig(event), opts, validate)
}

// ────────────────────────────────────────────
// Embeddings
// ────────────────────────────────────────────

/**
 * Whether the embedding model accepts the `dimensions` request parameter.
 * We need {@link EMBEDDING_DIMS}-sized vectors, so it is sent whenever supported:
 * - OpenAI `text-embedding-3-*` (ada-002 is 1536 natively and rejects the parameter)
 * - Google `gemini-embedding-*` through Gemini's OpenAI-compatible endpoint
 *   (its native size is larger, so without `dimensions` the vectors are rejected)
 */
export function supportsEmbeddingDimensions(model: string): boolean {
  return /text-embedding-3|gemini-embedding/i.test(model)
}

/** Local (offline) embeddings for a whole batch, at {@link EMBEDDING_DIMS}. */
function localBatch(prepared: string[]): EmbedResult {
  return { vectors: prepared.map((t) => localEmbedding(t, EMBEDDING_DIMS)), mode: 'local', dims: EMBEDDING_DIMS }
}

/**
 * Testable core of {@link embedTexts}.
 * Demo ⇒ local. Over budget ⇒ H3 429. Any API failure ⇒ whole batch local
 * (vectors already fetched from the API are discarded; tokens spent are still recorded).
 */
export async function embedTextsWith(config: AiConfig, texts: string[], deps: AiDeps = {}): Promise<EmbedResult> {
  if (!Array.isArray(texts)) throw createError({ statusCode: 400, statusMessage: 'texts harus berupa array' })
  if (texts.length > MAX_EMBED_TEXTS) {
    throw createError({ statusCode: 400, statusMessage: `Maksimal ${MAX_EMBED_TEXTS} teks per permintaan embedding` })
  }
  const prepared = texts.map((t) => normalizeForEmbedding(String(t ?? '')).slice(0, MAX_EMBED_INPUT_CHARS))
  if (prepared.length === 0) return { vectors: [], mode: config.isDemo ? 'local' : 'api', dims: EMBEDDING_DIMS }
  if (config.isDemo) return localBatch(prepared)
  if ((deps.isOverBudget ?? isOverBudget)()) throw budgetError()

  const doFetch = deps.fetch ?? ((input, init) => fetch(input, init))
  const record = deps.recordUsage ?? recordUsage
  const timeoutMs = deps.timeoutMs ?? EMBED_TIMEOUT_MS
  const supportsDims = supportsEmbeddingDimensions(config.embeddingModel)

  // The API rejects empty strings: send only non-empty texts, zero vectors for the rest.
  const indices = prepared.map((t, i) => (t ? i : -1)).filter((i) => i >= 0)
  const vectors: number[][] = prepared.map(() => new Array<number>(EMBEDDING_DIMS).fill(0))

  try {
    for (let start = 0; start < indices.length; start += EMBED_BATCH_SIZE) {
      const idx = indices.slice(start, start + EMBED_BATCH_SIZE)
      const input = idx.map((i) => prepared[i]!)
      const body: Record<string, unknown> = { model: config.embeddingModel, input }
      if (supportsDims) body.dimensions = EMBEDDING_DIMS

      const data = await postJson(doFetch, `${config.baseUrl}/embeddings`, config.apiKey, body, timeoutMs)
      record(Number(data?.usage?.prompt_tokens ?? data?.usage?.total_tokens ?? estimateTokens(input.join(' '))), 0)

      const rows: Array<{ index?: number; embedding?: unknown }> = Array.isArray(data?.data) ? data.data : []
      if (rows.length !== input.length) {
        throw new AiUnavailableError('invalid_response', `Expected ${input.length} embeddings, got ${rows.length}`)
      }
      rows.forEach((row, pos) => {
        const at = typeof row.index === 'number' ? row.index : pos
        const emb = row.embedding
        if (
          at < 0 || at >= idx.length ||
          !Array.isArray(emb) ||
          !emb.every((v) => typeof v === 'number' && Number.isFinite(v))
        ) {
          throw new AiUnavailableError('invalid_response', 'Malformed embedding in API response')
        }
        if (emb.length !== EMBEDDING_DIMS) {
          throw new AiUnavailableError(
            'invalid_response',
            `Embedding model "${config.embeddingModel}" returned ${emb.length} dimensions, expected ${EMBEDDING_DIMS}`
          )
        }
        vectors[idx[at]!] = emb as number[]
      })
    }
    return { vectors, mode: 'api', dims: EMBEDDING_DIMS }
  } catch (err) {
    if (!isAiUnavailable(err)) throw err
    console.warn(`[AI] Embedding API unavailable (${err.reason}), using local embeddings: ${err.message}`)
    return localBatch(prepared)
  }
}

/**
 * Embed a batch of texts. Texts are normalised (`normalizeForEmbedding`) and
 * truncated to {@link MAX_EMBED_INPUT_CHARS}; empty texts get a zero vector.
 *
 * - API key set: `${baseUrl}/embeddings` with `aiEmbeddingModel`, sub-batches of
 *   {@link EMBED_BATCH_SIZE}, usage recorded ⇒ `mode: 'api'`.
 * - No key, or ANY API failure: `localEmbedding` for the WHOLE batch ⇒ `mode: 'local'`.
 *
 * `dims` is always {@link EMBEDDING_DIMS} (1536) so results fit `lesson_chunks.embedding`,
 * but vectors of different modes are NOT comparable: store/compare `mode` too.
 *
 * @throws H3Error 400 for more than {@link MAX_EMBED_TEXTS} texts, 429 when over budget
 */
export function embedTexts(event: H3Event, texts: string[]): Promise<EmbedResult> {
  return embedTextsWith(getAiConfig(event), texts)
}
