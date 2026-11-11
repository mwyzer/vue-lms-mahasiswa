/**
 * Notifications Store — Unit Tests (demo mode)
 *
 * Per-user lists, unread counts, read/delete actions, deadline reminders,
 * and the notifications raised by the assignments and announcements stores.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useNotificationsStore, DEADLINE_REMINDER_HOURS } from '~/stores/notifications'
import { useAuthStore } from '~/stores/auth'
import { useCoursesStore } from '~/stores/courses'
import { useAssignmentsStore } from '~/stores/assignments'
import { useAnnouncementsStore } from '~/stores/announcements'

const HOUR = 60 * 60 * 1000

async function initStores() {
  await useAuthStore().init()
  await useCoursesStore().init()
  await useAssignmentsStore().init()
  await useAnnouncementsStore().init()
}

async function loginStudent(nama = 'Ahmad Fauzi', npm = '20241001') {
  expect(await useAuthStore().loginAsStudent(nama, npm, 'mahasiswa123')).toBe(true)
  await useNotificationsStore().init()
}

async function loginInstructor(nama = 'Dr. Andi Wijaya') {
  expect(await useAuthStore().loginAsInstructor(nama, 'instruktur123')).toBe(true)
  await useNotificationsStore().init()
}

describe('notifications store (demo mode)', () => {
  beforeEach(initStores)

  it('shows nothing when signed out', async () => {
    const store = useNotificationsStore()
    await store.init()
    expect(store.mine).toEqual([])
    expect(store.unreadCount).toBe(0)
  })

  it('shows only the signed-in user\'s notifications, newest first', async () => {
    await loginStudent()
    const store = useNotificationsStore()
    expect(store.mine.length).toBeGreaterThan(0)
    expect(store.mine.every((n) => n.user_id === 's1')).toBe(true)
    const times = store.mine.map((n) => new Date(n.created_at).getTime())
    expect([...times].sort((a, b) => b - a)).toEqual(times)
  })

  it('creates notifications for other users but never for the actor', async () => {
    await loginInstructor()
    const store = useNotificationsStore()
    const created = store.notifyUsers(['s1', 's2', 'i1', 's1'], { tipe: 'sistem', judul: 'Uji notifikasi' })
    expect(created).toBe(2) // i1 is the actor, s1 de-duplicated
    expect(store.mine.some((n) => n.judul === 'Uji notifikasi')).toBe(false)

    await loginStudent()
    expect(store.mine.some((n) => n.judul === 'Uji notifikasi' && !n.read_at)).toBe(true)
  })

  it('respects dedupe_key per user', async () => {
    await loginInstructor()
    const store = useNotificationsStore()
    const payload = { tipe: 'sistem' as const, judul: 'Sekali saja', dedupe_key: 'test:dedupe' }
    expect(store.notifyUsers(['s3'], payload)).toBe(1)
    expect(store.notifyUsers(['s3'], payload)).toBe(0)
    expect(store.notifyUsers(['s4'], payload)).toBe(1)
  })

  it('marks one, then all, as read', async () => {
    await loginInstructor()
    const store = useNotificationsStore()
    store.notifyUsers(['s5'], { tipe: 'sistem', judul: 'Satu' })
    store.notifyUsers(['s5'], { tipe: 'sistem', judul: 'Dua' })

    await loginStudent('Eka Putra', '20241005')
    expect(store.unreadCount).toBe(2)

    await store.markRead(store.mine[0].id)
    expect(store.unreadCount).toBe(1)

    await store.markAllRead()
    expect(store.unreadCount).toBe(0)
    expect(store.mine).toHaveLength(2)
  })

  it('removes a notification', async () => {
    await loginInstructor()
    const store = useNotificationsStore()
    store.notifyUsers(['s6'], { tipe: 'sistem', judul: 'Hapus saya' })

    await loginStudent('Fitri Handayani', '20241006')
    const target = store.mine.find((n) => n.judul === 'Hapus saya')!
    await store.remove(target.id)
    expect(store.mine.some((n) => n.id === target.id)).toBe(false)
  })

  it('reloads when a different user signs in and clears on reset', async () => {
    await loginStudent()
    const store = useNotificationsStore()
    expect(store.loadedForUserId).toBe('s1')

    await loginInstructor()
    expect(store.loadedForUserId).toBe('i1')
    expect(store.mine.every((n) => n.user_id === 'i1')).toBe(true)

    store.reset()
    expect(store.items).toEqual([])
    expect(store.initialized).toBe(false)
  })

  it('notifies enrolled students when an instructor creates an assignment', async () => {
    await loginInstructor()
    const judul = `Tugas Notifikasi ${Date.now()}`
    await useAssignmentsStore().addAssignment('c1', judul, 'desk', '2030-01-01T00:00:00Z')

    const items = useNotificationsStore().items.filter((n) => n.judul === `Tugas baru: ${judul}`)
    // c1 is level 1 morning → s1, s2, s3
    expect(items.map((n) => n.user_id).sort()).toEqual(['s1', 's2', 's3'])
    expect(items.every((n) => n.tipe === 'tugas' && /^\/assignments\//.test(n.link || ''))).toBe(true)
  })

  it('notifies the student when a submission is graded', async () => {
    await loginInstructor()
    await useAssignmentsStore().gradeSubmission('sub3', 77, 'Cukup baik')

    const n = useNotificationsStore().items.find(
      (x) => x.user_id === 's1' && x.tipe === 'nilai' && x.link === '/assignments/a2' && x.pesan === 'Nilai Anda: 77'
    )
    expect(n).toBeTruthy()
    expect(n!.judul).toContain('Kalkulator')
  })

  it('notifies the student on direct grading', async () => {
    await loginInstructor()
    await useAssignmentsStore().directGradeStudent('c1', 'a2', 's3', 64, '')
    expect(useNotificationsStore().items.some(
      (x) => x.user_id === 's3' && x.tipe === 'nilai' && x.pesan === 'Nilai Anda: 64'
    )).toBe(true)
  })

  it('notifies enrolled students about a new announcement', async () => {
    await loginInstructor()
    const judul = `Info ${Date.now()}`
    expect(await useAnnouncementsStore().createAnnouncement('c1', judul, 'Isi pengumuman')).toBe(true)

    const items = useNotificationsStore().items.filter((n) => n.judul === `Pengumuman: ${judul}`)
    expect(items.map((n) => n.user_id).sort()).toEqual(['s1', 's2', 's3'])
    expect(items[0].link).toBe('/courses/c1')
  })

  describe('deadline reminders', () => {
    it('reminds once for an unsubmitted assignment due within the window', async () => {
      await loginInstructor()
      const due = new Date('2031-03-10T12:00:00Z')
      const judul = `Tugas Deadline ${Date.now()}`
      await useAssignmentsStore().addAssignment('c1', judul, 'desk', due.toISOString())

      await loginStudent()
      const store = useNotificationsStore()
      const isReminder = (n: { tipe: string; judul: string }) => n.tipe === 'deadline' && n.judul.includes(judul)

      // Outside the window → nothing
      expect(store.syncDeadlineReminders(due.getTime() - (DEADLINE_REMINDER_HOURS + 1) * HOUR)).toBe(0)
      expect(store.mine.some(isReminder)).toBe(false)

      // Inside the window → one reminder
      expect(store.syncDeadlineReminders(due.getTime() - 2 * HOUR)).toBe(1)
      expect(store.mine.filter(isReminder)).toHaveLength(1)

      // Running again does not duplicate it
      expect(store.syncDeadlineReminders(due.getTime() - 1 * HOUR)).toBe(0)
      expect(store.mine.filter(isReminder)).toHaveLength(1)
    })

    it('does not remind after the deadline or once submitted', async () => {
      await loginInstructor()
      const due = new Date('2031-05-10T12:00:00Z')
      const judul = `Tugas Sudah Kumpul ${Date.now()}`
      const assignments = useAssignmentsStore()
      await assignments.addAssignment('c1', judul, 'desk', due.toISOString())
      const created = assignments.assignments.find((a) => a.judul === judul)!

      await loginStudent('Citra Dewi', '20241003')
      const store = useNotificationsStore()

      expect(store.syncDeadlineReminders(due.getTime() + HOUR)).toBe(0)

      await assignments.submitAssignment(created.id, 'jawaban')
      expect(store.syncDeadlineReminders(due.getTime() - 2 * HOUR)).toBe(0)
    })

    it('never creates reminders for instructors', async () => {
      await loginInstructor()
      expect(useNotificationsStore().syncDeadlineReminders()).toBe(0)
    })
  })
})
