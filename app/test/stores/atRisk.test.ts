/**
 * At-risk + import stores — Unit Tests (demo mode)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useAtRiskStore } from '~/stores/atRisk'
import { useImportJobsStore } from '~/stores/importJobs'
import { useAuthStore } from '~/stores/auth'
import { useNotificationsStore } from '~/stores/notifications'
import { buildStudentImportPreview } from '~/utils/studentImport'

async function loginInstructor(nama = 'Dr. Andi Wijaya') {
  await useAuthStore().init()
  expect(await useAuthStore().loginAsInstructor(nama, 'instruktur123')).toBe(true)
}

describe('atRisk store (demo)', () => {
  beforeEach(async () => {
    await loginInstructor()
    await useAtRiskStore().init()
  })

  it('builds one row per enrolled student, sorted by risk, with demo reference date', () => {
    const store = useAtRiskStore()
    const rows = store.rowsForCourses(['c1'])
    expect(rows.map((r) => r.student_id).sort()).toEqual(['s1', 's2', 's3'])
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].risk.score).toBeGreaterThanOrEqual(rows[i].risk.score)
    // Citra (s3) has no submissions for the two past-due assignments → top risk
    expect(rows[0].student_id).toBe('s3')
    expect(rows[0].risk.reasons[0].text).toMatch(/2 dari 2 tugas/)
    // Demo reference = latest recorded activity (not today's date)
    expect(new Date(store.referenceNow).getFullYear()).toBe(2025)
  })

  it('sends a reminder notification to the student and logs both interventions', async () => {
    const store = useAtRiskStore()
    const row = store.rowsForCourses(['c1']).find((r) => r.student_id === 's3')!
    expect(await store.sendReminder(row, 'Tolong kumpulkan tugas 1 dan 2.')).toBe(true)
    expect(await store.markFollowedUp(row, 'Sudah dihubungi')).toBe(true)

    const after = store.rowsForCourses(['c1']).find((r) => r.student_id === 's3')!
    expect(after.lastReminder?.catatan).toBe('Tolong kumpulkan tugas 1 dan 2.')
    expect(after.lastFollowUp?.catatan).toBe('Sudah dihubungi')
    expect(store.historyFor('c1', 's3').map((h) => h.tipe).sort()).toEqual(['followup', 'reminder'])

    // The student sees it in their notification centre
    const auth = useAuthStore()
    await auth.logout()
    expect(await auth.loginAsStudent('Citra Dewi', '20241003', 'mahasiswa123')).toBe(true)
    const notifs = useNotificationsStore()
    await notifs.init()
    expect(notifs.mine.some((n) => n.judul.startsWith('Pengingat dari dosen: MK101'))).toBe(true)
  })

  it('rejects an empty reminder and invalid weights', async () => {
    const store = useAtRiskStore()
    const row = store.rowsForCourses(['c1'])[0]
    expect(await store.sendReminder(row, '   ')).toBe(false)
    expect(store.error).toMatch(/kosong/)
    expect(store.setWeights({ attendance: 0, missing: 0, late: 0, trend: 0, lowScore: 0, inactivity: 0 })).toMatch(/Minimal/)
    expect(store.setWeights({ attendance: 100, missing: 0, late: 0, trend: 0, lowScore: 0, inactivity: 0 })).toBeNull()
    // Only attendance now: s2 has 1 alpha out of 3 meetings
    const s2 = store.rowsForCourses(['c1']).find((r) => r.student_id === 's2')!
    expect(s2.risk.reasons.map((r) => r.key)).toEqual(['attendance'])
    store.resetWeights()
  })
})

describe('importJobs store (demo)', () => {
  beforeEach(async () => {
    await loginInstructor()
  })

  it('adds valid rows to the roster with the course level/session and records a job', async () => {
    const auth = useAuthStore()
    const course = { id: 'c5', kode: 'MK201', level: 2, session_time: 'morning' as const, label: 'MK201 — Struktur Data' }
    const preview = buildStudentImportPreview('nama,npm\nWulan Sari,20269001\nAhmad Lagi,20241001\n', auth.studentRoster, course)
    expect(preview.summary).toMatchObject({ valid: 1, duplicate: 1 })

    const store = useImportJobsStore()
    const res = await store.importStudents(preview.rows.filter((r) => r.data).map((r) => r.data!), { fileName: 'a.csv', course })
    expect(res).toMatchObject({ ok: true, created: 1, failed: [] })
    const added = auth.studentRoster.find((s) => s.npm === '20269001')!
    expect(added).toMatchObject({ nama: 'Wulan Sari', level: 2, session_time: 'morning', kelas: '2A' })
    expect(store.jobs[0]).toMatchObject({ file_name: 'a.csv', created: 1, total: 1, mode: 'demo' })

    // Importing the same row again is refused as a duplicate
    const again = await store.importStudents([preview.rows[0].data!], { fileName: 'a.csv', course })
    expect(again.created).toBe(0)
    expect(again.failed[0].error).toMatch(/sudah terdaftar/)
  })
})
