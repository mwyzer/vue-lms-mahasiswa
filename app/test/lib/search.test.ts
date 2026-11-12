/**
 * Global search — ranking, grouping and role-aware index building.
 */
import { describe, it, expect } from 'vitest'
import {
  buildSearchIndex,
  commandItems,
  groupHits,
  lexicalScore,
  normalizeSearch,
  rankItems,
  routeFor,
  withinOneEdit,
  type IndexSource,
  type SearchItem,
} from '~/lib/search'
import { rankLocally } from '~/composables/useGlobalSearch'

const item = (id: string, title: string, extra: Partial<SearchItem> = {}): SearchItem => ({ id, type: 'lesson', title, to: `/x/${id}`, ...extra })

describe('normalizeSearch / withinOneEdit', () => {
  it('lowercases, strips diacritics and punctuation', () => {
    expect(normalizeSearch('  Café — Relasi & Fungsi! ')).toBe('cafe relasi fungsi')
  })
  it('detects one edit', () => {
    expect(withinOneEdit('variabel', 'variable')).toBe(true) // swap
    expect(withinOneEdit('himpunan', 'himpunn')).toBe(true) // delete
    expect(withinOneEdit('looping', 'lopping')).toBe(true) // substitute
    expect(withinOneEdit('looping', 'loop')).toBe(false)
  })
})

describe('lexical ranking', () => {
  const items = [
    item('body', 'Pengantar', { body: 'Materi ini membahas perulangan for dan while.' }),
    item('prefix', 'Perulangan (Looping)'),
    item('exact', 'Perulangan'),
    item('other', 'Himpunan'),
  ]

  it('ranks exact title > title prefix > body match and drops non-matches', () => {
    const ids = rankItems('perulangan', items).map((h) => h.id)
    expect(ids).toEqual(['exact', 'prefix', 'body'])
  })

  it('matches word prefixes and one-typo words in titles', () => {
    expect(rankItems('perul', items)[0]!.id).toBe('exact')
    expect(rankItems('himpunn', items).map((h) => h.id)).toEqual(['other'])
  })

  it('requires most query tokens to match (coverage)', () => {
    expect(lexicalScore('perulangan himpunan relasi', item('x', 'Perulangan'))).toBe(0)
    expect(lexicalScore('perulangan while', items[0]!)).toBeGreaterThan(0)
  })

  it('returns nothing for an empty query', () => {
    expect(rankItems('   ', items)).toEqual([])
  })

  it('semantic scores boost ranking and can surface non-lexical hits above the threshold', () => {
    const sem = { other: 0.9, body: 0.2 }
    const ids = rankItems('pengulangan kode', items, { semantic: sem }).map((h) => h.id)
    expect(ids[0]).toBe('other')
    expect(ids).not.toContain('body') // below SEMANTIC_ONLY_MIN and no lexical match
  })

  it('rankLocally (local embedding from aiText) still finds inflected words', () => {
    const hits = rankLocally('variabelnya', [item('v', 'Variabel dan Tipe Data'), item('h', 'Himpunan')])
    expect(hits.map((h) => h.id)).toEqual(['v'])
  })
})

describe('groupHits', () => {
  it('groups in fixed type order with a per-group cap', () => {
    const hits = [
      { ...item('t1', 'a'), type: 'thread' as const, score: 9 },
      { ...item('c1', 'a'), type: 'course' as const, score: 1 },
      ...[1, 2, 3].map((n) => ({ ...item(`l${n}`, 'a'), score: 5 - n })),
    ]
    const groups = groupHits(hits, 2)
    expect(groups.map((g) => g.type)).toEqual(['course', 'lesson', 'thread'])
    expect(groups[1]!.items.map((h) => h.id)).toEqual(['l1', 'l2'])
    expect(groups[1]!.label).toBe('Materi')
  })
})

describe('buildSearchIndex (visibility)', () => {
  const source = (role: IndexSource['role']): IndexSource => ({
    role,
    courses: [{ id: 'c1', kode: 'MK101', nama: 'Pemrograman Dasar' }],
    lessons: [
      { id: 'l1', course_id: 'c1', judul: 'Variabel' },
      { id: 'l9', course_id: 'c9', judul: 'Rahasia kursus lain' },
    ],
    quizzes: [
      { id: 'q1', course_id: 'c1', judul: 'Kuis aktif', is_active: true },
      { id: 'q2', course_id: 'c1', judul: 'Kuis draf', is_active: false },
    ],
    assignments: [{ id: 'a1', course_id: 'c1', judul: 'Tugas 1' }, { id: 'a9', course_id: 'c9', judul: 'Tugas lain' }],
    threads: [{ id: 't1', course_id: 'c1', judul: 'Tanya for' }, { id: 't9', course_id: 'c9', judul: 'Thread lain' }],
  })

  it('drops everything outside the visible courses', () => {
    const ids = buildSearchIndex(source('student')).map((i) => i.id)
    expect(ids).not.toContain('lesson:l9')
    expect(ids).not.toContain('assignment:a9')
    expect(ids).not.toContain('thread:t9')
  })

  it('students only see active quizzes; instructors see all', () => {
    expect(buildSearchIndex(source('student')).map((i) => i.id)).toEqual(
      ['course:c1', 'lesson:l1', 'quiz:q1', 'assignment:a1', 'thread:t1'],
    )
    expect(buildSearchIndex(source('instructor')).map((i) => i.id)).toContain('quiz:q2')
  })

  it('uses role-specific routes', () => {
    const student = buildSearchIndex(source('student'))
    expect(student.find((i) => i.id === 'lesson:l1')!.to).toBe('/courses/c1/lessons/l1')
    expect(student.find((i) => i.id === 'thread:t1')!.to).toBe('/courses/c1/forum/t1')
    const instr = buildSearchIndex(source('instructor'))
    expect(instr.find((i) => i.id === 'assignment:a1')!.to).toBe('/instructor/courses/c1/assignments')
    expect(routeFor('admin', 'course', 'c1', 'c1')).toBe('/admin/courses')
  })

  it('has per-role commands including the theme toggle', () => {
    expect(commandItems('student').map((c) => c.to)).toContain('/student/progress')
    expect(commandItems('instructor').map((c) => c.to)).not.toContain('/student/progress')
    expect(commandItems('admin').some((c) => c.action === 'toggle-theme')).toBe(true)
    expect(rankItems('progres', commandItems('student'))[0]!.to).toBe('/student/progress')
  })
})
