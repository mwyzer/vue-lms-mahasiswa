/**
 * Plagiarism Utility — Unit Tests
 *
 * Tests the pure text-similarity algorithm: tokenization, shingles,
 * Jaccard similarity, and the submission comparison helper.
 */
import { describe, it, expect } from 'vitest'
import {
  tokenize,
  shingles,
  jaccard,
  textSimilarity,
  severityLabel,
  checkSubmissionAgainst,
  type SubmissionLike,
} from '../../../server/utils/plagiarism'

describe('tokenize', () => {
  it('lowercases and splits on non-alphanumeric characters', () => {
    expect(tokenize('Hello, World! print("Hi")')).toEqual(['hello', 'world', 'print', 'hi'])
  })

  it('returns an empty array for empty/whitespace input', () => {
    expect(tokenize('')).toEqual([])
    expect(tokenize('   ')).toEqual([])
  })

  it('keeps digits and normalizes camelCase into separate tokens', () => {
    expect(tokenize('bubbleSort2025 OK')).toEqual(['bubblesort2025', 'ok'])
  })
})

describe('shingles', () => {
  it('builds overlapping n-grams', () => {
    const tokens = ['a', 'b', 'c', 'd']
    expect(shingles(tokens, 3)).toEqual(['a b c', 'b c d'])
  })

  it('returns a single shingle when the text is shorter than n', () => {
    expect(shingles(['a', 'b'], 3)).toEqual(['a b'])
  })

  it('returns an empty array for no tokens', () => {
    expect(shingles([], 3)).toEqual([])
  })
})

describe('jaccard', () => {
  it('returns 0 for disjoint sets', () => {
    expect(jaccard(['a'], ['b'])).toBe(0)
  })

  it('returns 1 for identical sets', () => {
    expect(jaccard(['a', 'b'], ['b', 'a'])).toBe(1)
  })

  it('returns partial similarity for overlapping sets', () => {
    expect(jaccard(['a', 'b', 'c'], ['a', 'b', 'd'])).toBeCloseTo(0.5)
  })

  it('returns 0 when both sets are empty', () => {
    expect(jaccard([], [])).toBe(0)
  })
})

describe('textSimilarity', () => {
  it('detects identical text as 100%', () => {
    const text = 'def kalkulator():\n    a = 10\n    b = 20\n    return a + b\n'
    expect(textSimilarity(text, text)).toBe(100)
  })

  it('detects heavily overlapping text with a high score', () => {
    const a = 'def kalkulator(a, b): return a + b'
    const b = 'def kalkulator(a, b):\n    hasil = a + b\n    return hasil'
    expect(textSimilarity(a, b)).toBeGreaterThanOrEqual(30)
  })

  it('returns 0 for completely different text', () => {
    expect(textSimilarity('lorem ipsum dolor sit amet', 'xyz qwerty asdfgh')).toBe(0)
  })

  it('is insensitive to casing and punctuation', () => {
    const a = 'def hitung_total(a, b):\n    return a + b'
    const b = 'def Hitung_Total (a, b):\n    return a + b'
    expect(textSimilarity(a, b)).toBe(100)
  })

  it('handles empty inputs without throwing', () => {
    expect(textSimilarity('', '')).toBe(0)
    expect(textSimilarity('some text here', '')).toBe(0)
  })
})

describe('severityLabel', () => {
  it('labels high / medium / low severities', () => {
    expect(severityLabel(85)).toBe('tinggi')
    expect(severityLabel(60)).toBe('sedang')
    expect(severityLabel(10)).toBe('rendah')
    expect(severityLabel(75)).toBe('tinggi')
    expect(severityLabel(40)).toBe('sedang')
  })
})

describe('checkSubmissionAgainst', () => {
  const peers: SubmissionLike[] = [
    {
      id: 's1',
      student_id: 'st1',
      student_name: 'Ahmad',
      jawaban: 'Fungsi hitungRataRata menerima daftar angka.\nHitung total dengan perulangan.\nBagi total dengan jumlah elemen pada daftar.\nKembalikan hasil pembagian total.\n',
    },
    {
      id: 's2',
      student_id: 'st2',
      student_name: 'Budi',
      jawaban: 'Fungsi hitungRataRata menerima daftar angka.\nHitung total memakai perulangan.\nBagi total dengan jumlah elemen pada array.\nKembalikan hasil dari pembagian tersebut.\n',
    },
    {
      id: 's3',
      student_id: 'st3',
      student_name: 'Citra',
      jawaban: 'Kelas ini membahas tentang struktur data queue.\nImplementasi menggunakan linked list saja.\n',
    },
    {
      id: 's4',
      student_id: 'st4',
      student_name: 'Dian',
      jawaban: 'Poster membahas tema kesehatan lingkungan sekitar.\nWarna diambil dari palet hijau kebiruan.\n',
    },
  ]

  it('ranks and reports matches for similar peers, sorted by score', () => {
    const result = checkSubmissionAgainst('s1', 'Ahmad', peers[0].jawaban || '', peers)
    const s2match = result.matches.find((m) => m.withId === 's2')
    expect(s2match).toBeDefined()
    expect(s2match!.score).toBeGreaterThan(0)
    const scores = result.matches.map((m) => m.score)
    expect([...scores].sort((x, y) => y - x)).toEqual(scores)
  })

  it('excludes the submission itself', () => {
    const result = checkSubmissionAgainst('s3', 'Citra', peers[2].jawaban || '', peers)
    expect(result.matches.every((m) => m.withId !== 's3')).toBe(true)
  })

  it('returns highestScore of 0 when there are no matches', () => {
    const result = checkSubmissionAgainst('s1', 'Ahmad', 'unique phrase alpha beta gamma', [
      { id: 's2', student_id: 'st2', student_name: 'Budi', jawaban: 'zzz yyy xxx www vvv' },
    ])
    expect(result.highestScore).toBe(0)
    expect(result.matches).toEqual([])
  })
})
// ════════════════════════════════════════════
// Semantic (embedding) second score
// ════════════════════════════════════════════
import { vi } from 'vitest'
import {
  buildPlagiarismReport,
  classifyMatch,
  isSemanticEligible,
  resolveLexicalThreshold,
  resolveSemanticThreshold,
  semanticCandidates,
  semanticScore,
  wordCount,
  LEXICAL_THRESHOLD,
  SEMANTIC_MIN_WORDS,
  SEMANTIC_THRESHOLDS,
  type SemanticInput,
} from '../../../server/utils/plagiarism'
import { localEmbedding, normalizeForEmbedding } from '../../../server/utils/aiText'
import { embedTextsWith, EMBEDDING_DIMS, type AiConfig, type FetchLike } from '../../../server/utils/ai'
import { FIXTURE_SUBMISSIONS, SYNTHETIC_API_VECTORS } from './plagiarism.fixture'

const longText = (seed: string) =>
  Array.from({ length: SEMANTIC_MIN_WORDS + 5 }, (_, i) => `${seed}${i}`).join(' ')

/** Local-mode vectors for a set of submissions (what embedTexts returns without an API key). */
function localInput(subs: SubmissionLike[]): SemanticInput {
  return {
    mode: 'local',
    vectorsById: Object.fromEntries(semanticCandidates(subs).map((s) => [s.id, localEmbedding(s.jawaban || '', 1536)])),
  }
}

const pairOf = (r: ReturnType<typeof buildPlagiarismReport>, a: string, b: string) =>
  r.pairs.find((p) => (p.a_id === a && p.b_id === b) || (p.a_id === b && p.b_id === a))

describe('semantic helpers', () => {
  it('semanticScore is cosine × 100, rounded, negatives clamped to 0', () => {
    expect(semanticScore([1, 0], [1, 0])).toBe(100)
    expect(semanticScore([1, 0], [0, 1])).toBe(0)
    expect(semanticScore([1, 0], [-1, 0])).toBe(0)
    expect(semanticScore([1, 1], [1, 0])).toBe(71)
    expect(semanticScore([0, 0], [1, 0])).toBe(0) // zero vector (empty text)
  })

  it('classifyMatch distinguishes lexical / semantic / both / none', () => {
    expect(classifyMatch(80, 90, 75, 85)).toBe('both')
    expect(classifyMatch(80, 50, 75, 85)).toBe('lexical')
    expect(classifyMatch(10, 90, 75, 85)).toBe('semantic')
    expect(classifyMatch(10, 50, 75, 85)).toBeNull()
    expect(classifyMatch(80, null, 75, 85)).toBe('lexical')
    expect(classifyMatch(10, 99, 75, null)).toBeNull()
  })

  it('thresholds default per mode and clamp overrides to sane bounds', () => {
    expect(resolveLexicalThreshold()).toBe(LEXICAL_THRESHOLD)
    expect(resolveLexicalThreshold(5)).toBe(20)
    expect(resolveLexicalThreshold(150)).toBe(100)
    expect(resolveLexicalThreshold('60')).toBe(LEXICAL_THRESHOLD) // only numbers accepted
    expect(resolveSemanticThreshold('api')).toBe(SEMANTIC_THRESHOLDS.api)
    expect(resolveSemanticThreshold('local')).toBe(SEMANTIC_THRESHOLDS.local)
    expect(SEMANTIC_THRESHOLDS.api).toBeGreaterThan(SEMANTIC_THRESHOLDS.local)
    expect(resolveSemanticThreshold('api', 40)).toBe(70)
    expect(resolveSemanticThreshold('local', 40)).toBe(50)
    expect(resolveSemanticThreshold('api', 100)).toBe(99)
    expect(resolveSemanticThreshold('api', Number.NaN)).toBe(SEMANTIC_THRESHOLDS.api)
  })

  it('short answers are not semantically eligible', () => {
    expect(wordCount('print("Hello, World!")')).toBe(3)
    expect(isSemanticEligible('print("Hello, World!")')).toBe(false)
    expect(isSemanticEligible(longText('kata'))).toBe(true)
    expect(isSemanticEligible(null)).toBe(false)
    // Unicode-aware word count (the lexical tokenizer is ASCII-only)
    expect(wordCount('généralisation ünïcode')).toBe(2)
  })
})

describe('buildPlagiarismReport — merge and shape', () => {
  it('keeps the legacy fields and lexical meaning (lexical-only matches unchanged)', () => {
    const subs = FIXTURE_SUBMISSIONS
    const r = buildPlagiarismReport(subs, localInput(subs))
    expect(r.threshold).toBe(75)
    expect(r.total).toBe(5)
    const legacy = checkSubmissionAgainst('orig', 'Ahmad', subs[0]!.jawaban, subs)
    const v2 = r.checked.find((c) => c.submissionId === 'orig')!
    expect(v2.highestScore).toBe(legacy.highestScore)
    for (const m of legacy.matches) {
      const mm = v2.matches.find((x) => x.withId === m.withId)!
      expect(mm.score).toBe(m.score)
      expect(mm.label).toBe(m.label)
      expect(mm.excerpt).toBe(m.excerpt)
    }
    expect(Object.keys(r).sort()).toEqual(['checked', 'flagged', 'pairs', 'semantic', 'threshold', 'total'])
    expect(Object.keys(r.semantic).sort()).toEqual(
      ['baseline', 'compared', 'effective_threshold', 'min_words', 'mode', 'note', 'skipped_short', 'threshold', 'truncated'],
    )
  })

  it('reports each flagged pair once with both scores, sorted by the higher score', () => {
    const subs: SubmissionLike[] = [
      { id: 'a', student_id: 'x1', student_name: 'A', jawaban: longText('alpha') },
      { id: 'b', student_id: 'x2', student_name: 'B', jawaban: longText('alpha') }, // identical ⇒ both
      { id: 'c', student_id: 'x3', student_name: 'C', jawaban: longText('gamma') },
      { id: 'd', student_id: 'x4', student_name: 'D', jawaban: longText('delta') },
    ]
    // Hand-built: c ~ d semantically (0.92), lexically disjoint.
    const vectorsById = {
      a: [1, 0, 0, 0],
      b: [1, 0, 0, 0],
      c: [0, 1, 0, 0],
      d: [0, 0.92, Math.sqrt(1 - 0.92 ** 2), 0],
    }
    const r = buildPlagiarismReport(subs, { mode: 'api', vectorsById })
    expect(r.pairs).toHaveLength(2)
    expect(r.pairs[0]).toMatchObject({ a_id: 'a', b_id: 'b', similarity: 100, semantic_similarity: 100, match_type: 'both' })
    expect(r.pairs[1]).toMatchObject({ a_id: 'c', b_id: 'd', similarity: 0, semantic_similarity: 92, match_type: 'semantic' })
    // Semantic-only peer appears in the per-submission view too, and makes it "flagged".
    const c = r.checked.find((x) => x.submissionId === 'c')!
    expect(c.matches.map((m) => m.withId)).toEqual(['d'])
    expect(c.matches[0]).toMatchObject({ score: 0, semantic_similarity: 92, match_type: 'semantic' })
    expect(c.highestSemantic).toBe(92)
    expect(r.flagged.map((f) => f.submissionId).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('skips short answers from the semantic comparison but keeps their lexical score', () => {
    const subs: SubmissionLike[] = [
      { id: 'h1', student_id: 's1', student_name: 'S1', jawaban: 'print("Hello, World!")' },
      { id: 'h2', student_id: 's2', student_name: 'S2', jawaban: 'print("Hello, World!")' },
      { id: 'l1', student_id: 's3', student_name: 'S3', jawaban: longText('satu') },
      { id: 'l2', student_id: 's4', student_name: 'S4', jawaban: longText('dua') },
    ]
    const input = localInput(subs)
    expect(Object.keys((input as any).vectorsById).sort()).toEqual(['l1', 'l2'])
    const r = buildPlagiarismReport(subs, input)
    expect(r.semantic).toMatchObject({ compared: 2, skipped_short: 2, min_words: SEMANTIC_MIN_WORDS })
    expect(r.semantic.note).toContain(`di bawah ${SEMANTIC_MIN_WORDS} kata`)
    const hello = pairOf(r, 'h1', 'h2')!
    expect(hello).toMatchObject({ similarity: 100, semantic_similarity: null, semantic_skipped: 'short', match_type: 'lexical' })
  })

  it('discloses truncation of long answers for embedding', () => {
    const big = Array.from({ length: 1200 }, (_, i) => `kata${i}`).join(' ') // > 8000 chars
    const subs: SubmissionLike[] = [
      { id: 'p', student_id: 'p', jawaban: big },
      { id: 'q', student_id: 'q', jawaban: big },
    ]
    expect(normalizeForEmbedding(big).length).toBeGreaterThan(8000)
    const r = buildPlagiarismReport(subs, localInput(subs))
    expect(r.semantic.truncated).toBe(2)
    expect(r.pairs[0]!.semantic_truncated).toBe(true)
    expect(r.semantic.note).toContain('8000 karakter pertama')
  })

  it('unavailable mode: lexical results only, null semantic scores, reason surfaced', () => {
    const subs = FIXTURE_SUBMISSIONS
    const r = buildPlagiarismReport(subs, { mode: 'unavailable', reason: 'budget', message: 'Batas harian tercapai' })
    expect(r.semantic).toMatchObject({ mode: 'unavailable', reason: 'budget', threshold: null, effective_threshold: null, compared: 0 })
    expect(r.semantic.note).toContain('batas harian')
    expect(r.semantic.note).toContain('Batas harian tercapai')
    expect(r.checked.every((c) => c.matches.every((m) => m.semantic_similarity === null))).toBe(true)
    expect(r.pairs.every((p) => p.match_type === 'lexical' && p.semantic_skipped === 'unavailable')).toBe(true)
  })

  it('applies overrides, clamped', () => {
    const subs = FIXTURE_SUBMISSIONS
    const r = buildPlagiarismReport(subs, localInput(subs), { lexicalThreshold: 50, semanticThreshold: 10 })
    expect(r.threshold).toBe(50)
    expect(r.semantic.threshold).toBe(50) // local floor
    expect(pairOf(r, 'orig', 'copy')!.match_type).toBe('both') // lexical 71 ≥ 50
  })

  it('class baseline raises the semantic threshold when everyone writes alike', () => {
    // 5 answers all ~0.90 cosine to each other, one pair at ~0.99.
    const subs: SubmissionLike[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, student_id: id, jawaban: longText(id) }))
    const base = (k: number, w = 0.3162) => {
      const v = new Array(8).fill(0)
      v[0] = Math.sqrt(1 - w * w)
      v[k] = w
      return v
    }
    const e = base(4)
    e[6] = 0.01 // e ≈ d (cosine ≈ 0.99+)
    const vectorsById: Record<string, number[]> = { a: base(1), b: base(2), c: base(3), d: base(4), e }
    const r = buildPlagiarismReport(subs, { mode: 'api', vectorsById })
    expect(r.semantic.baseline).toBe(90)
    expect(r.semantic.threshold).toBe(85)
    expect(r.semantic.effective_threshold).toBe(99) // min(99, 90 + 10)
    expect(r.semantic.note).toContain('ambang semantik dinaikkan')
    expect(r.pairs.map((p) => `${p.a_id}${p.b_id}`)).toEqual(['de'])
  })

  it('no baseline with fewer than 6 eligible pairs', () => {
    const subs = FIXTURE_SUBMISSIONS.slice(0, 3)
    const r = buildPlagiarismReport(subs, localInput(subs))
    expect(r.semantic.baseline).toBeNull()
    expect(r.semantic.effective_threshold).toBe(r.semantic.threshold)
  })

  it('is deterministic', () => {
    const a = buildPlagiarismReport(FIXTURE_SUBMISSIONS, localInput(FIXTURE_SUBMISSIONS))
    const b = buildPlagiarismReport(FIXTURE_SUBMISSIONS, localInput(FIXTURE_SUBMISSIONS))
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('handles a class-sized batch quickly (O(n²) pairs)', () => {
    const subs: SubmissionLike[] = Array.from({ length: 120 }, (_, i) => ({
      id: `s${i}`,
      student_id: `st${i}`,
      jawaban: `Jawaban mahasiswa nomor ${i} tentang stack dan queue. ` + longText(`w${i % 17}x`),
    }))
    const t0 = performance.now()
    const r = buildPlagiarismReport(subs, localInput(subs))
    const ms = performance.now() - t0
    expect(r.total).toBe(120)
    expect(ms).toBeLessThan(5000)
  })
})

describe('Indonesian fixture — LOCAL embeddings (no API key)', () => {
  const r = buildPlagiarismReport(FIXTURE_SUBMISSIONS, localInput(FIXTURE_SUBMISSIONS))
  const sem = (a: string, b: string) => {
    const subs = FIXTURE_SUBMISSIONS
    const va = localEmbedding(subs.find((s) => s.id === a)!.jawaban, 1536)
    const vb = localEmbedding(subs.find((s) => s.id === b)!.jawaban, 1536)
    return semanticScore(va, vb)
  }
  const lex = (a: string, b: string) =>
    textSimilarity(FIXTURE_SUBMISSIONS.find((s) => s.id === a)!.jawaban, FIXTURE_SUBMISSIONS.find((s) => s.id === b)!.jawaban)

  it('exact numbers (documented in the report)', () => {
    expect([lex('orig', 'copy'), sem('orig', 'copy')]).toEqual([71, 96])
    expect([lex('orig', 'para'), sem('orig', 'para')]).toEqual([0, 37])
    expect([lex('orig', 'ind1'), sem('orig', 'ind1')]).toEqual([0, 41])
    expect([lex('orig', 'ind2'), sem('orig', 'ind2')]).toEqual([0, 42])
    expect([lex('ind1', 'ind2'), sem('ind1', 'ind2')]).toEqual([1, 46])
    expect(r.semantic).toMatchObject({ mode: 'local', threshold: 70, effective_threshold: 70, compared: 5, skipped_short: 0 })
    expect(r.semantic.baseline).toBe(42) // median of the 10 pair scores (41 and 42 ⇒ 41.5)
  })

  it('catches the lightly edited copy that the lexical score alone misses (71 < 75)', () => {
    const p = pairOf(r, 'orig', 'copy')!
    expect(p).toMatchObject({ similarity: 71, semantic_similarity: 96, match_type: 'semantic' })
  })

  it('KNOWN LIMITATION: the genuine paraphrase is NOT caught locally', () => {
    expect(pairOf(r, 'orig', 'para')).toBeUndefined()
    expect(pairOf(r, 'copy', 'para')).toBeUndefined()
    // It even scores below the independent answers: local vectors are lexical.
    expect(sem('orig', 'para')).toBeLessThan(sem('orig', 'ind1'))
    expect(r.semantic.note).toMatch(/tidak dapat mendeteksi parafrase/)
  })

  it('independent answers on the same question are not flagged', () => {
    expect(r.pairs).toHaveLength(1)
    expect(r.flagged.map((f) => f.submissionId).sort()).toEqual(['copy', 'orig'])
  })
})

describe('Indonesian fixture — API mode via embedTextsWith + mocked fetch (synthetic vectors)', () => {
  const LIVE: AiConfig = {
    apiKey: 'sk-test',
    model: 'gpt-test',
    embeddingModel: 'text-embedding-3-small',
    baseUrl: 'https://llm.example/v1',
    isDemo: false,
  }
  const byText = new Map(
    FIXTURE_SUBMISSIONS.map((s) => [normalizeForEmbedding(s.jawaban), SYNTHETIC_API_VECTORS[s.id]!]),
  )
  const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
    const body = JSON.parse(String(init?.body))
    const data = (body.input as string[]).map((t, index) => ({ index, embedding: byText.get(t) }))
    return new Response(JSON.stringify({ data, usage: { prompt_tokens: 100 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })

  it('flags the paraphrase semantically and leaves independent answers alone', async () => {
    const cands = semanticCandidates(FIXTURE_SUBMISSIONS)
    const emb = await embedTextsWith(LIVE, cands.map((c) => c.jawaban || ''), {
      fetch: fetchMock,
      isOverBudget: () => false,
      recordUsage: () => {},
    })
    expect(emb.mode).toBe('api')
    expect(emb.dims).toBe(EMBEDDING_DIMS)
    expect(fetchMock).toHaveBeenCalledTimes(1) // one batch ⇒ one shared mode
    const r = buildPlagiarismReport(FIXTURE_SUBMISSIONS, {
      mode: 'api',
      vectorsById: Object.fromEntries(cands.map((c, i) => [c.id, emb.vectors[i]!])),
    })
    expect(r.semantic).toMatchObject({ mode: 'api', threshold: 85, effective_threshold: 85, baseline: 65 })
    expect(r.semantic.note).toBeUndefined()
    expect(pairOf(r, 'orig', 'para')).toMatchObject({ similarity: 0, semantic_similarity: 94, match_type: 'semantic' })
    expect(pairOf(r, 'copy', 'para')).toMatchObject({ match_type: 'semantic' })
    expect(pairOf(r, 'orig', 'copy')).toMatchObject({ similarity: 71, semantic_similarity: 100, match_type: 'semantic' })
    expect(pairOf(r, 'orig', 'ind1')).toBeUndefined()
    expect(r.pairs).toHaveLength(3)
    expect(r.pairs[0]!.semantic_similarity).toBe(100) // sorted by max score
  })

  it('budget exhausted ⇒ embedTextsWith throws H3 429 (route maps it to mode "unavailable")', async () => {
    await expect(
      embedTextsWith(LIVE, ['teks'], { fetch: fetchMock, isOverBudget: () => true, recordUsage: () => {} }),
    ).rejects.toMatchObject({ statusCode: 429 })
  })
})
