/**
 * Forum Store — Unit Tests (demo mode)
 *
 * Thread listing/ordering, creating threads and replies, validation,
 * and permission checks for moderation and deletion.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useForumStore, THREAD_TITLE_MAX, POST_BODY_MAX } from '~/stores/forum'
import { useAuthStore } from '~/stores/auth'
import { useCoursesStore } from '~/stores/courses'
import { useNotificationsStore } from '~/stores/notifications'

async function loginStudent(nama = 'Ahmad Fauzi', npm = '20241001') {
  expect(await useAuthStore().loginAsStudent(nama, npm, 'mahasiswa123')).toBe(true)
}

async function loginInstructor(nama = 'Dr. Andi Wijaya') {
  expect(await useAuthStore().loginAsInstructor(nama, 'instruktur123')).toBe(true)
}

describe('forum store (demo mode)', () => {
  beforeEach(async () => {
    await useAuthStore().init()
    await useCoursesStore().init()
    await useForumStore().init()
  })

  it('lists threads of a course with pinned threads first', () => {
    const threads = useForumStore().threadsByCourse('c1')
    expect(threads.length).toBeGreaterThanOrEqual(2)
    expect(threads[0].is_pinned).toBe(true)
    expect(threads.every((t) => t.course_id === 'c1')).toBe(true)
  })

  it('decorates threads with author, reply count and answered flag', () => {
    const t = useForumStore().threadById('ft1')!
    expect(t.author_name).toBe('Budi Santoso')
    expect(t.author_role).toBe('student')
    expect(t.reply_count).toBe(2)
    expect(t.has_answer).toBe(true)
    expect(t.last_activity).toBe('2025-08-12T13:30:00Z')
  })

  it('returns replies oldest first with author info', () => {
    const replies = useForumStore().repliesForThread('ft1')
    expect(replies.map((r) => r.id)).toEqual(['fr1', 'fr2'])
    expect(replies[1].author_role).toBe('instructor')
  })

  it('creates a thread as a student', async () => {
    await loginStudent()
    const forum = useForumStore()
    const id = await forum.createThread('c1', '  Pertanyaan baru  ', 'Isi pertanyaan', 'l1')
    expect(id).toBeTruthy()
    const t = forum.threadById(id!)!
    expect(t.judul).toBe('Pertanyaan baru')
    expect(t.author_id).toBe('s1')
    expect(t.lesson_id).toBe('l1')
    expect(t.reply_count).toBe(0)
  })

  it('rejects empty or oversized threads', async () => {
    await loginStudent()
    const forum = useForumStore()
    expect(await forum.createThread('c1', '   ', 'isi')).toBeNull()
    expect(await forum.createThread('c1', 'judul', '   ')).toBeNull()
    expect(await forum.createThread('c1', 'x'.repeat(THREAD_TITLE_MAX + 1), 'isi')).toBeNull()
    expect(await forum.createThread('c1', 'judul', 'x'.repeat(POST_BODY_MAX + 1))).toBeNull()
    expect(forum.error).toBeTruthy()
  })

  it('does nothing when nobody is signed in', async () => {
    const forum = useForumStore()
    expect(await forum.createThread('c1', 'judul', 'isi')).toBeNull()
    expect(await forum.addReply('ft1', 'halo')).toBe(false)
  })

  it('adds a reply, bumps activity and notifies the thread author', async () => {
    await loginStudent() // s1 replies to s2's thread
    const forum = useForumStore()
    const before = forum.threadById('ft1')!

    expect(await forum.addReply('ft1', 'Terima kasih, jadi jelas.')).toBe(true)

    const after = forum.threadById('ft1')!
    expect(after.reply_count).toBe(before.reply_count + 1)
    expect(new Date(after.last_activity).getTime()).toBeGreaterThan(new Date(before.last_activity).getTime())

    const notif = useNotificationsStore().items.find(
      (n) => n.user_id === 's2' && n.tipe === 'forum' && n.link === '/courses/c1/forum/ft1'
    )
    expect(notif).toBeTruthy()
    expect(notif!.judul).toContain('Ahmad Fauzi')
  })

  it('does not notify authors about their own replies', async () => {
    await loginStudent('Budi Santoso', '20241002') // s2 owns ft1
    const notifications = useNotificationsStore()
    const before = notifications.items.filter((n) => n.user_id === 's2' && n.tipe === 'forum').length
    expect(await useForumStore().addReply('ft1', 'Menambahkan konteks.')).toBe(true)
    expect(notifications.items.filter((n) => n.user_id === 's2' && n.tipe === 'forum').length).toBe(before)
  })

  it('blocks student replies on locked threads but allows the course instructor', async () => {
    const forum = useForumStore()

    await loginStudent()
    expect(await forum.addReply('ft2', 'Boleh tanya?')).toBe(false)
    expect(forum.error).toContain('dikunci')

    await loginInstructor()
    expect(await forum.addReply('ft2', 'Tambahan aturan.')).toBe(true)
  })

  it('only the course instructor or an admin can moderate', async () => {
    const forum = useForumStore()

    await loginStudent()
    expect(forum.canModerate('c1')).toBe(false)
    expect(await forum.togglePin('ft1')).toBe(false)
    expect(await forum.setAnswer('fr1', true)).toBe(false)

    await loginInstructor('Dr. Dewi Lestari') // i2 does not teach c1
    expect(forum.canModerate('c1')).toBe(false)
    expect(await forum.toggleLock('ft1')).toBe(false)

    await loginInstructor() // i1 teaches c1
    expect(forum.canModerate('c1')).toBe(true)
    expect(await forum.togglePin('ft1')).toBe(true)
    expect(forum.threadById('ft1')!.is_pinned).toBe(true)
    expect(await forum.togglePin('ft1')).toBe(true)
    expect(forum.threadById('ft1')!.is_pinned).toBe(false)

    expect(await forum.setAnswer('fr1', true)).toBe(true)
    expect(forum.repliesForThread('ft1').find((r) => r.id === 'fr1')!.is_answer).toBe(true)
    expect(await forum.setAnswer('fr1', false)).toBe(true)
  })

  it('lets authors delete their own posts but not other students\' posts', async () => {
    const forum = useForumStore()

    await loginStudent() // s1
    expect(await forum.deleteThread('ft1')).toBe(false) // owned by s2
    expect(await forum.deleteReply('fr2')).toBe(false) // owned by i1

    const id = (await forum.createThread('c1', 'Akan dihapus', 'isi'))!
    expect(await forum.addReply(id, 'balasan sendiri')).toBe(true)
    const replyId = forum.repliesForThread(id)[0].id
    expect(await forum.deleteReply(replyId)).toBe(true)
    expect(forum.repliesForThread(id)).toHaveLength(0)
    expect(await forum.deleteThread(id)).toBe(true)
    expect(forum.threadById(id)).toBeNull()
  })

  it('deleting a thread as moderator removes its replies too', async () => {
    const forum = useForumStore()
    await loginStudent('Budi Santoso', '20241002')
    const id = (await forum.createThread('c1', 'Thread uji moderasi', 'isi'))!
    await loginStudent()
    expect(await forum.addReply(id, 'balasan')).toBe(true)

    await loginInstructor()
    expect(await forum.deleteThread(id)).toBe(true)
    expect(forum.replies.some((r) => r.thread_id === id)).toBe(false)
  })
})
