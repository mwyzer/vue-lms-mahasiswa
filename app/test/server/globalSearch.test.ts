/**
 * GET /api/search core (server/utils/globalSearch.ts) with a mocked Supabase client.
 */
import { describe, it, expect, vi } from 'vitest'
import { loadSearchSource, runGlobalSearch } from '../../../server/utils/globalSearch'

function mockDb(tables: Record<string, Array<Record<string, any>>>, rpcRows: unknown[] | Error = []) {
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])]
    const q: any = {
      select: () => q,
      eq: (col: string, v: unknown) => ((rows = rows.filter((r) => r[col] === v)), q),
      in: (col: string, vs: unknown[]) => ((rows = rows.filter((r) => vs.includes(r[col]))), q),
      limit: () => q,
      then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
    }
    return q
  }
  const rpc = vi.fn(async () => (rpcRows instanceof Error ? { data: null, error: { message: rpcRows.message } } : { data: rpcRows, error: null }))
  return { from, rpc }
}

const TABLES = {
  courses: [
    { id: 'C1', kode: 'MK101', nama: 'Pemrograman Dasar', instructor_id: 'I1' },
    { id: 'C2', kode: 'MK999', nama: 'Kursus Lain', instructor_id: 'I2' },
  ],
  enrollments: [{ student_id: 'S1', course_id: 'C1' }],
  lessons: [
    { id: 'L1', course_id: 'C1', judul: 'Perulangan', konten: 'for dan while' },
    { id: 'L2', course_id: 'C1', judul: 'Tipe Data', konten: 'int float' },
    { id: 'L9', course_id: 'C2', judul: 'Perulangan rahasia', konten: '' },
  ],
  quizzes: [
    { id: 'Q1', course_id: 'C1', judul: 'Kuis perulangan', is_active: false },
  ],
  assignments: [{ id: 'A1', course_id: 'C1', judul: 'Tugas perulangan' }],
  forum_threads: [{ id: 'T9', course_id: 'C2', judul: 'Perulangan di kursus lain' }],
}

describe('loadSearchSource', () => {
  it('limits students to enrolled courses and instructors to taught courses', async () => {
    const db = mockDb(TABLES)
    const s = await loadSearchSource(db, { userId: 'S1', role: 'student' })
    expect(s.courses.map((c) => c.id)).toEqual(['C1'])
    expect(s.lessons!.map((l) => l.id)).toEqual(['L1', 'L2'])
    const i = await loadSearchSource(db, { userId: 'I2', role: 'instructor' })
    expect(i.courses.map((c) => c.id)).toEqual(['C2'])
    const none = await loadSearchSource(db, { userId: 'nobody', role: 'student' })
    expect(none.courses).toEqual([])
  })
})

describe('runGlobalSearch', () => {
  it('returns only visible items, without body text, lexical mode without embed', async () => {
    const res = await runGlobalSearch(mockDb(TABLES), { userId: 'S1', role: 'student' }, 'perulangan')
    const ids = res.results.map((r) => r.id)
    expect(ids).toContain('lesson:L1')
    expect(ids).toContain('assignment:A1')
    expect(ids).not.toContain('lesson:L9')
    expect(ids).not.toContain('thread:T9')
    expect(ids).not.toContain('quiz:Q1') // inactive quiz hidden from students
    expect(res.mode).toBe('lexical')
    expect(res.results.every((r) => !('body' in r))).toBe(true)
  })

  it('boosts lessons with pgvector similarity (semantic mode with API embeddings)', async () => {
    const db = mockDb(TABLES, [{ lesson_id: 'L2', course_id: 'C1', chunk_index: 0, content: 'int float', similarity: 0.9 }])
    const embed = vi.fn(async () => ({ vectors: [[0.1, 0.2]], mode: 'api' as const, dims: 2 }))
    const res = await runGlobalSearch(db, { userId: 'S1', role: 'student' }, 'bilangan desimal', { embed })
    expect(res.mode).toBe('semantic')
    expect(res.results[0]!.id).toBe('lesson:L2')
    expect(db.rpc).toHaveBeenCalledWith('match_lesson_chunks', expect.objectContaining({ p_course_ids: ['C1'] }))
  })

  it('falls back to lexical when pgvector fails', async () => {
    const db = mockDb(TABLES, new Error('function does not exist'))
    const embed = vi.fn(async () => ({ vectors: [[0.1]], mode: 'api' as const, dims: 1 }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await runGlobalSearch(db, { userId: 'S1', role: 'student' }, 'perulangan', { embed })
    expect(res.mode).toBe('lexical')
    expect(res.results[0]!.id).toBe('lesson:L1')
    warn.mockRestore()
  })
})
