/**
 * exportCourseGrades (assignment-page Excel export) must use the final,
 * peer-blended score — the same one the gradebook shows — not the
 * instructor-only score (Prioritas 3b-B follow-up).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const captured: { rows: any[] } = { rows: [] }

vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: (rows: any[]) => {
      captured.rows = rows
      return {}
    },
    book_new: () => ({}),
    book_append_sheet: () => {},
  },
  write: () => new ArrayBuffer(0),
}))

vi.mock('~/composables/useNotification', () => ({
  useNotification: () => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }),
}))

// Assignment a1 has peer review (weight 20%); a2 has none.
vi.mock('~/stores/rubrics', () => ({
  useRubricsStore: () => ({
    rubricFor: (id: string) => (id === 'a1' ? { peer: { enabled: true, weight: 20 } } : null),
    finalScoreFor: (s: { id: string; assignment_id: string; nilai: number | null }) =>
      s.assignment_id === 'a1' && s.nilai !== null ? Math.round(s.nilai * 0.8 + 100 * 0.2) : s.nilai,
  }),
}))

import { useExportGrades } from '~/composables/useExportGrades'

describe('exportCourseGrades with peer review', () => {
  beforeEach(() => {
    captured.rows = []
    ;(globalThis as any).URL.createObjectURL = vi.fn(() => 'blob:x')
    ;(globalThis as any).URL.revokeObjectURL = vi.fn()
  })

  it('uses the blended score and adds an instructor-score column only where peer review is on', () => {
    const { exportCourseGrades } = useExportGrades()
    const subs: Record<string, any[]> = {
      a1: [{ id: 's1', student_name: 'Ani', student_npm: '1', nilai: 50, submitted_at: '2025-01-01' }],
      a2: [{ id: 's2', student_name: 'Budi', student_npm: '2', nilai: 50, submitted_at: '2025-01-01' }],
    }
    exportCourseGrades(
      'MK101',
      [{ id: 'a1', judul: 'Tugas 1' }, { id: 'a2', judul: 'Tugas 2' }],
      (id) => subs[id] ?? [],
    )

    const [r1, r2] = captured.rows
    // 50 * 0.8 + 100 * 0.2 = 60 → blended, and the instructor score is kept alongside it
    expect(r1['Nilai']).toBe(60)
    expect(r1['Nilai Dosen']).toBe(50)
    expect(r1['Status']).toBe('Lulus')
    // No peer review: unchanged behaviour, no extra column
    expect(r2['Nilai']).toBe(50)
    expect(r2['Nilai Dosen']).toBeUndefined()
    expect(r2['Status']).toBe('Tidak Lulus')
  })

  it('keeps ungraded submissions as "Belum Dinilai"', () => {
    const { exportCourseGrades } = useExportGrades()
    exportCourseGrades(
      'MK101',
      [{ id: 'a1', judul: 'Tugas 1' }],
      () => [{ id: 's3', student_name: 'Cici', student_npm: '3', nilai: null, submitted_at: '2025-01-01' }],
    )
    expect(captured.rows[0]['Nilai']).toBe('-')
    expect(captured.rows[0]['Status']).toBe('Belum Dinilai')
  })
})
