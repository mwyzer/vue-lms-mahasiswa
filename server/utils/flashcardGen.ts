/**
 * Flashcard Generator — pure logic for "Buat flashcard dengan AI" from a lesson.
 *
 * No Nitro globals here (no createError / useRuntimeConfig) so everything is
 * unit-testable from Vitest. The route `server/api/ai/generate-flashcards.post.ts`
 * wires it to the shared AI client (`chatJsonWith`) and maps errors to HTTP.
 *
 * Contents:
 *   - parseFlashcardGenRequest   — validate + normalise the request body
 *   - buildFlashcardGenPrompt    — prompt with lesson text wrapped as untrusted data
 *   - validateFlashcardGenOutput — strict check of a model reply (dedupe, truncate)
 *   - generateDemoFlashcards     — deterministic offline (no-LLM) cards
 *   - runFlashcardGeneration     — orchestration: model → validate → fallback
 *
 * Nothing is persisted here: the client shows the cards as DRAFTS and only
 * saves the ones the student keeps.
 */
import { hashText, UNTRUSTED_NOTICE, wrapUntrusted } from './aiText'

export interface GeneratedFlashcard {
  front: string
  back: string
}

export interface FlashcardGenRequest {
  lesson: { judul: string; konten: string }
  count: number
  /** Fronts of cards the user already has (for dedupe). */
  existing: string[]
  seed?: number
}

export interface FlashcardGenResponse {
  cards: GeneratedFlashcard[]
  source: 'ai' | 'demo'
  requested: number
  generated: number
}

export const FLASHCARDGEN_LIMITS = {
  COUNT_MIN: 1,
  COUNT_MAX: 20,
  COUNT_DEFAULT: 8,
  LESSON_MIN_CHARS: 80,
  LESSON_MAX_CHARS: 50_000,
  PROMPT_LESSON_CHARS: 12_000,
  JUDUL_MAX_CHARS: 200,
  EXISTING_MAX_ITEMS: 500,
  EXISTING_ITEM_MAX_CHARS: 500,
  EXISTING_IN_PROMPT: 60,
  FRONT_MAX_CHARS: 300,
  BACK_MAX_CHARS: 800,
  BODY_MAX_BYTES: 256 * 1024,
} as const

export type FlashcardGenParseResult = { ok: true; value: FlashcardGenRequest } | { ok: false; message: string }

/** Parse `count`: integer in [1, 20]; missing/invalid ⇒ 8; out of range ⇒ clamped. */
export function clampFlashcardGenCount(raw: unknown): number {
  const L = FLASHCARDGEN_LIMITS
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN
  if (!Number.isFinite(n)) return L.COUNT_DEFAULT
  return Math.min(L.COUNT_MAX, Math.max(L.COUNT_MIN, Math.round(n)))
}

/** Validate and normalise a raw request body. Never throws; messages are Indonesian (400). */
export function parseFlashcardGenRequest(body: unknown): FlashcardGenParseResult {
  const L = FLASHCARDGEN_LIMITS
  const fail = (message: string): FlashcardGenParseResult => ({ ok: false, message })
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Body permintaan tidak valid.')
  const b = body as Record<string, unknown>
  const lesson = b.lesson
  if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) return fail('Materi (lesson) wajib dikirim.')
  const l = lesson as Record<string, unknown>
  if (l.judul !== undefined && l.judul !== null && typeof l.judul !== 'string') return fail('Judul materi harus berupa teks.')
  const judul = typeof l.judul === 'string' ? l.judul.trim() : ''
  if (judul.length > L.JUDUL_MAX_CHARS) return fail(`Judul materi terlalu panjang (maksimal ${L.JUDUL_MAX_CHARS} karakter).`)
  if (typeof l.konten !== 'string' || !l.konten.trim()) return fail('Isi materi kosong. Pilih materi yang memiliki isi.')
  const konten = l.konten.trim()
  if (konten.length < L.LESSON_MIN_CHARS) {
    return fail(`Isi materi terlalu pendek (${konten.length} karakter). Minimal ${L.LESSON_MIN_CHARS} karakter.`)
  }
  if (konten.length > L.LESSON_MAX_CHARS) {
    return fail(`Isi materi terlalu panjang (${konten.length} karakter). Maksimal ${L.LESSON_MAX_CHARS} karakter.`)
  }
  let existing: string[] = []
  if (b.existing !== undefined && b.existing !== null) {
    if (!Array.isArray(b.existing)) return fail('Daftar kartu yang sudah ada (existing) harus berupa array teks.')
    if (b.existing.length > L.EXISTING_MAX_ITEMS) return fail(`Terlalu banyak kartu yang sudah ada (maksimal ${L.EXISTING_MAX_ITEMS}).`)
    existing = b.existing
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim().slice(0, L.EXISTING_ITEM_MAX_CHARS))
      .filter(Boolean)
  }
  let seed: number | undefined
  if (typeof b.seed === 'number' && Number.isFinite(b.seed)) seed = Math.abs(Math.floor(b.seed)) >>> 0
  return { ok: true, value: { lesson: { judul, konten }, count: clampFlashcardGenCount(b.count), existing, seed } }
}

/** Comparison key: case-, whitespace- and trailing-punctuation-insensitive. */
export function flashcardGenKey(s: string): string {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s"'“”‘’(]+|[\s"'“”‘’).,;:!?…]+$/g, '')
}

/** Build the chat prompt; the lesson and existing fronts are wrapped as untrusted data. */
export function buildFlashcardGenPrompt(req: FlashcardGenRequest): { system: string; user: string } {
  const L = FLASHCARDGEN_LIMITS
  const system = [
    'Kamu adalah asisten belajar yang membuat flashcard berbahasa Indonesia untuk mahasiswa.',
    'Buat kartu HANYA dari isi materi yang diberikan; jangan menambahkan fakta dari luar materi.',
    'Aturan setiap kartu:',
    '- "front": satu pertanyaan atau istilah yang jelas dan berdiri sendiri;',
    '- "back": jawaban singkat dan tepat (1–2 kalimat) menurut materi;',
    '- satu konsep per kartu, jangan duplikat, jangan menyalin seluruh paragraf;',
    `- front maksimal ${L.FRONT_MAX_CHARS} karakter, back maksimal ${L.BACK_MAX_CHARS} karakter.`,
    'Jangan membuat ulang kartu yang sudah dimiliki pengguna.',
    UNTRUSTED_NOTICE,
    'Balas HANYA dengan satu objek JSON berbentuk persis: {"cards":[{"front":"...","back":"..."}]}',
  ].join('\n')
  const parts = [
    `Buat ${Math.min(req.count + 2, L.COUNT_MAX + 2)} flashcard dari materi berikut.`,
    '',
    wrapUntrusted('JUDUL_MATERI', req.lesson.judul || '(tanpa judul)', L.JUDUL_MAX_CHARS),
    '',
    wrapUntrusted('MATERI', req.lesson.konten, L.PROMPT_LESSON_CHARS),
  ]
  const shown = req.existing.slice(0, L.EXISTING_IN_PROMPT)
  if (shown.length > 0) {
    parts.push('', 'Kartu yang SUDAH ADA (jangan dibuat ulang):', wrapUntrusted('KARTU_YANG_ADA', shown.map((f, i) => `${i + 1}. ${f.slice(0, 200)}`).join('\n'), 15_000))
  }
  return { system, user: parts.join('\n') }
}

function cardText(v: unknown): string | null {
  if (typeof v === 'string') return v.replace(/\r\n?/g, '\n').trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return null
}

/** Strictly validate one card: non-empty front/back within limits, front ≠ back. */
export function validateFlashcardGenCard(raw: unknown): GeneratedFlashcard | null {
  const L = FLASHCARDGEN_LIMITS
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const front = cardText(r.front ?? r.pertanyaan ?? r.question)
  const back = cardText(r.back ?? r.jawaban ?? r.answer)
  if (!front || !back) return null
  if (front.length > L.FRONT_MAX_CHARS || back.length > L.BACK_MAX_CHARS) return null
  if (flashcardGenKey(front) === flashcardGenKey(back)) return null
  return { front, back }
}

/**
 * Validate a parsed model reply `{ "cards": [...] }` (a bare array is tolerated).
 * Invalid cards and duplicates (of each other or of `existing`) are dropped; the rest truncated to `count`.
 */
export function validateFlashcardGenOutput(
  raw: unknown,
  opts: { count: number; existing?: readonly string[] },
): GeneratedFlashcard[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { cards?: unknown }).cards)
      ? (raw as { cards: unknown[] }).cards
      : null
  if (!list) return []
  const seen = new Set((opts.existing ?? []).map(flashcardGenKey).filter(Boolean))
  const out: GeneratedFlashcard[] = []
  for (const item of list) {
    if (out.length >= Math.max(0, Math.floor(opts.count))) break
    const c = validateFlashcardGenCard(item)
    if (!c) continue
    const key = flashcardGenKey(c.front)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}

// ────────────────────────────────────────────
// Deterministic fallback (demo mode / AI unavailable)
// ────────────────────────────────────────────

/** Seedable PRNG (mulberry32). */
export function flashcardGenRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function flashcardPlainText(src: string): string {
  let s = String(src ?? '').replace(/\r\n?/g, '\n')
  s = s.replace(/(```|~~~)[\s\S]*?(\1|$)/g, '\n')
  s = s.replace(/<\/?[a-zA-Z][^<>]*>/g, ' ').replace(/&nbsp;/gi, ' ')
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  s = s.replace(/`+/g, '').replace(/(\*\*|__|\*|~~)/g, '')
  return s
}

function flashcardSentences(plain: string): string[] {
  const out: string[] = []
  for (const raw of plain.split('\n')) {
    const line = raw.replace(/^\s{0,3}#{1,6}\s+/, '').replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim()
    if (!line) continue
    for (const s of line.split(/(?<=[.!?…])\s+(?=[A-Z0-9"“(])/)) {
      const t = s.replace(/\s+/g, ' ').trim()
      if (t.length >= 25 && t.length <= 400) out.push(t)
    }
  }
  return out
}

/** "X adalah Y" / "X merupakan Y" / "X disebut Y" / "X digunakan untuk Y" definition patterns. */
const DEFINITION_RE = /^(.{3,80}?)\s+(adalah|merupakan|ialah|yaitu|disebut|digunakan untuk|dipakai untuk|berfungsi untuk)\s+(.{8,})$/i

const DEFINITION_QUESTION: Record<string, (term: string) => string> = {
  adalah: (t) => `Apa yang dimaksud dengan ${t}?`,
  merupakan: (t) => `Apa yang dimaksud dengan ${t}?`,
  ialah: (t) => `Apa yang dimaksud dengan ${t}?`,
  yaitu: (t) => `${t}, yaitu …?`,
  disebut: (t) => `${t} disebut apa?`,
  'digunakan untuk': (t) => `${t} digunakan untuk apa?`,
  'dipakai untuk': (t) => `${t} dipakai untuk apa?`,
  'berfungsi untuk': (t) => `${t} berfungsi untuk apa?`,
}

function cleanTerm(t: string): string {
  return t
    .replace(/^(dalam pemrograman|di python|pada [^,]+),\s*/i, '')
    .replace(/^(sebuah|suatu|seorang)\s+/i, '')
    .replace(/[,;:]+$/, '')
    .trim()
}

const FLASHCARD_STOP = new Set(
  'yang dan di ke dari untuk dengan pada adalah ini itu atau juga dalam akan tidak dapat bisa oleh sebagai karena sehingga maka jika ada lebih sudah telah setiap semua bahwa tersebut seperti antara hanya harus agar saat ketika merupakan yaitu suatu sebuah secara biasanya misalnya contohnya kita kami'.split(' '),
)

/**
 * Deterministic, offline card generator (no LLM). Two kinds of cards:
 *   1. definition cards from "X adalah/merupakan/disebut … Y" sentences
 *      (front: "Apa yang dimaksud dengan X?", back: the sentence);
 *   2. cloze cards: a sentence with its most frequent key term blanked
 *      (front: "Lengkapi: … _____ …", back: the term).
 * Same input + seed ⇒ same output. Returns `[]` when nothing usable is found.
 */
export function generateDemoFlashcards(req: FlashcardGenRequest, rng: () => number): GeneratedFlashcard[] {
  const sentences = flashcardSentences(flashcardPlainText(req.lesson.konten))
  const seen = new Set(req.existing.map(flashcardGenKey).filter(Boolean))
  const out: GeneratedFlashcard[] = []
  const push = (c: GeneratedFlashcard) => {
    const v = validateFlashcardGenCard(c)
    if (!v) return
    const k = flashcardGenKey(v.front)
    if (seen.has(k)) return
    seen.add(k)
    out.push(v)
  }

  const usedSentences = new Set<string>()

  // 1. Definitions (in lesson order — they usually build on each other).
  for (const s of sentences) {
    if (out.length >= req.count) break
    const m = s.match(DEFINITION_RE)
    if (!m) continue
    const term = cleanTerm(m[1]!)
    const words = term.split(/\s+/)
    const verb = m[2]!.toLowerCase()
    if (words.length === 0 || words.length > (verb === 'yaitu' ? 8 : 5) || /^(ini|itu|hal|cara|kita|program)$/i.test(term)) continue
    const q = (DEFINITION_QUESTION[verb] ?? DEFINITION_QUESTION.adalah!)(term.charAt(0).toUpperCase() + term.slice(1))
    const before = out.length
    push({ front: q, back: s })
    if (out.length > before) usedSentences.add(s)
  }

  // 2. Cloze cards on frequent key terms, sentence order shuffled by the seeded rng.
  if (out.length < req.count) {
    const freq = new Map<string, number>()
    for (const s of sentences) {
      for (const w of s.toLowerCase().match(/[\p{L}][\p{L}\p{N}_-]{3,}/gu) ?? []) {
        if (!FLASHCARD_STOP.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1)
      }
    }
    const order = sentences.map((s, i) => ({ s, w: rng(), i })).sort((a, b) => a.w - b.w || a.i - b.i)
    const usedTerms = new Set<string>()
    for (const { s } of order) {
      if (out.length >= req.count) break
      if (usedSentences.has(s)) continue
      const words = (s.match(/[\p{L}][\p{L}\p{N}_-]{3,}/gu) ?? []).filter((w) => !FLASHCARD_STOP.has(w.toLowerCase()))
      const best = words
        .map((w) => ({ w, f: freq.get(w.toLowerCase()) ?? 0 }))
        .filter((x) => !usedTerms.has(x.w.toLowerCase()))
        .sort((a, b) => b.f - a.f || b.w.length - a.w.length || (a.w < b.w ? -1 : 1))[0]
      if (!best || best.f < 2) continue
      const re = new RegExp(`(?<![\\p{L}\\p{N}_])${best.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'giu')
      const blanked = s.replace(re, '_____')
      if (!blanked.includes('_____')) continue
      usedTerms.add(best.w.toLowerCase())
      push({ front: `Lengkapi: ${blanked}`, back: best.w })
    }
  }
  return out.slice(0, req.count)
}

export const FLASHCARDGEN_EMPTY_MESSAGE =
  'Materi terlalu pendek atau kurang bervariasi untuk membuat flashcard contoh (mode demo). Pilih materi lain atau buat kartu manual.'

export class FlashcardGenEmptyError extends Error {
  constructor(message = FLASHCARDGEN_EMPTY_MESSAGE) {
    super(message)
    this.name = 'FlashcardGenEmptyError'
  }
}

/** Model caller (route: `(o, v) => chatJsonWith(config, o, v)`); must throw AiUnavailableError when unusable. */
export type FlashcardGenModelCall = (
  opts: { system: string; user: string; temperature?: number; maxTokens?: number },
  validate: (raw: unknown) => GeneratedFlashcard[] | null,
) => Promise<GeneratedFlashcard[]>

/** Default seed: stable hash of the input. */
export function flashcardGenSeed(req: Pick<FlashcardGenRequest, 'lesson' | 'count'>): number {
  return parseInt(hashText(`${req.lesson.judul}\n${req.lesson.konten}\n${req.count}`).slice(0, 8), 16) >>> 0
}

/**
 * Pipeline: model (unless `callModel` is null ⇒ demo) → strict validation;
 * AiUnavailableError or zero valid cards ⇒ deterministic fallback (`source: 'demo'`);
 * any other error (e.g. H3 429 budget) propagates.
 * @throws FlashcardGenEmptyError when nothing valid could be produced
 */
export async function runFlashcardGeneration(
  req: FlashcardGenRequest,
  callModel: FlashcardGenModelCall | null,
  opts: { rng?: () => number; onFallback?: (err: unknown) => void } = {},
): Promise<FlashcardGenResponse> {
  let cards: GeneratedFlashcard[] = []
  let source: 'ai' | 'demo' = 'ai'
  if (callModel) {
    try {
      cards = await callModel(
        { ...buildFlashcardGenPrompt(req), temperature: 0.3, maxTokens: Math.min(4000, 300 + (req.count + 2) * 160) },
        (raw) => {
          const v = validateFlashcardGenOutput(raw, { count: req.count, existing: req.existing })
          return v.length > 0 ? v : null
        },
      )
      cards = validateFlashcardGenOutput(cards, { count: req.count, existing: req.existing })
    } catch (err) {
      if ((err as { name?: unknown } | null)?.name !== 'AiUnavailableError') throw err
      opts.onFallback?.(err)
      cards = []
    }
  }
  if (cards.length === 0) {
    source = 'demo'
    cards = generateDemoFlashcards(req, opts.rng ?? flashcardGenRng(req.seed ?? flashcardGenSeed(req)))
  }
  if (cards.length === 0) throw new FlashcardGenEmptyError()
  return { cards, source, requested: req.count, generated: cards.length }
}
