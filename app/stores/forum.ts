/**
 * Forum Store — course discussion threads and replies.
 *
 * Features:
 * - Threads per course (optionally linked to a lesson), pinned threads first
 * - Replies, with one or more replies marked as the answer by the instructor
 * - Moderation: instructor of the course (or admin) can pin, lock, delete
 * - Demo mode + Supabase production mode
 */
import { defineStore } from 'pinia'
import type { ForumThread, ForumReply } from '~/types/database'
import { useAuthStore } from './auth'
import { useCoursesStore } from './courses'
import { useNotificationsStore } from './notifications'

export interface ThreadWithMeta extends ForumThread {
  author_name: string
  author_role: 'student' | 'instructor' | 'admin' | null
  reply_count: number
  has_answer: boolean
  last_activity: string
}

export interface ReplyWithMeta extends ForumReply {
  author_name: string
  author_role: 'student' | 'instructor' | 'admin' | null
}

export const THREAD_TITLE_MAX = 150
export const POST_BODY_MAX = 5000

// ── Demo data ──────────────────────────────────────────
const DEMO_THREADS: ForumThread[] = [
  { id: 'ft1', course_id: 'c1', lesson_id: 'l4', author_id: 's2', judul: 'Kapan pakai for dan kapan pakai while?', konten: 'Saya masih bingung membedakan kapan sebaiknya memakai for dan kapan while. Ada patokan sederhananya?', is_pinned: false, is_locked: false, created_at: '2025-08-12T09:00:00Z', updated_at: '2025-08-12T13:30:00Z' },
  { id: 'ft2', course_id: 'c1', lesson_id: null, author_id: 'i1', judul: 'Aturan diskusi kelas Pemrograman Dasar', konten: 'Gunakan forum ini untuk bertanya soal materi dan tugas. Jangan membagikan jawaban tugas secara utuh — jelaskan pendekatannya saja.', is_pinned: true, is_locked: true, created_at: '2025-08-01T08:00:00Z', updated_at: '2025-08-01T08:00:00Z' },
  { id: 'ft3', course_id: 'c2', lesson_id: 'l5', author_id: 's1', judul: 'Beda himpunan bagian dan himpunan kuasa', konten: 'Apakah himpunan kosong selalu termasuk himpunan bagian? Lalu bagaimana menghitung jumlah anggota himpunan kuasa?', is_pinned: false, is_locked: false, created_at: '2025-08-07T10:00:00Z', updated_at: '2025-08-07T10:00:00Z' },
]

const DEMO_REPLIES: ForumReply[] = [
  { id: 'fr1', thread_id: 'ft1', author_id: 's1', konten: 'Setahu saya for dipakai kalau jumlah perulangannya sudah diketahui, while kalau bergantung pada kondisi.', is_answer: false, created_at: '2025-08-12T10:15:00Z' },
  { id: 'fr2', thread_id: 'ft1', author_id: 'i1', konten: 'Betul. Patokannya: tahu berapa kali mengulang (atau mengulang isi sebuah koleksi) → for. Mengulang sampai suatu kondisi berubah (mis. input pengguna valid) → while.', is_answer: true, created_at: '2025-08-12T13:30:00Z' },
]

let demoSeq = 0

interface ForumState {
  threads: ForumThread[]
  replies: ForumReply[]
  loading: boolean
  error: string | null
  isDemoMode: boolean
  initialized: boolean
}

export const useForumStore = defineStore('forum', {
  state: (): ForumState => ({
    threads: [],
    replies: [],
    loading: false,
    error: null,
    isDemoMode: true,
    initialized: false,
  }),

  getters: {
    /** Resolve a user ID to a display name + role using the rosters in the auth store. */
    authorInfo(): (userId: string) => { name: string; role: 'student' | 'instructor' | 'admin' | null } {
      return (userId: string) => {
        const auth = useAuthStore()
        if (auth.user?.id === userId) return { name: auth.user.nama, role: auth.user.role }
        const student = auth.students.find((s) => s.id === userId)
        if (student) return { name: student.nama, role: 'student' }
        const instructor = auth.instructors.find((i) => i.id === userId)
        if (instructor) return { name: instructor.nama, role: 'instructor' }
        const admin = auth.admins.find((a) => a.id === userId)
        if (admin) return { name: admin.nama, role: 'admin' }
        return { name: 'Pengguna', role: null }
      }
    },

    /** Threads of a course: pinned first, then most recent activity. */
    threadsByCourse(): (courseId: string) => ThreadWithMeta[] {
      return (courseId: string) =>
        this.threads
          .filter((t) => t.course_id === courseId)
          .map((t) => this.decorateThread(t))
          .sort((a, b) =>
            Number(b.is_pinned) - Number(a.is_pinned)
            || new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
          )
    },

    threadById(): (threadId: string) => ThreadWithMeta | null {
      return (threadId: string) => {
        const t = this.threads.find((x) => x.id === threadId)
        return t ? this.decorateThread(t) : null
      }
    },

    /** Replies of a thread, oldest first. */
    repliesForThread(): (threadId: string) => ReplyWithMeta[] {
      return (threadId: string) =>
        this.replies
          .filter((r) => r.thread_id === threadId)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map((r) => {
            const info = this.authorInfo(r.author_id)
            return { ...r, author_name: info.name, author_role: info.role }
          })
    },

    threadCount(): (courseId: string) => number {
      return (courseId: string) => this.threads.filter((t) => t.course_id === courseId).length
    },

    /** Instructor of the course, or admin. */
    canModerate(): (courseId: string) => boolean {
      return (courseId: string) => {
        const auth = useAuthStore()
        if (!auth.user) return false
        if (auth.isAdmin) return true
        if (!auth.isInstructor) return false
        const course = useCoursesStore().allCourses.find((c) => c.id === courseId)
        return course?.instructor_id === auth.user.id
      }
    },
  },

  actions: {
    decorateThread(t: ForumThread): ThreadWithMeta {
      const info = this.authorInfo(t.author_id)
      const replies = this.replies.filter((r) => r.thread_id === t.id)
      const lastReply = replies.reduce<string>(
        (latest, r) => (new Date(r.created_at).getTime() > new Date(latest).getTime() ? r.created_at : latest),
        t.created_at
      )
      return {
        ...t,
        author_name: info.name,
        author_role: info.role,
        reply_count: replies.length,
        has_answer: replies.some((r) => r.is_answer),
        last_activity: lastReply,
      }
    },

    async init() {
      if (this.initialized) return
      const ui = useUiStore()
      this.isDemoMode = ui.isDemoMode
      this.error = null

      if (!this.isDemoMode) {
        this.loading = true
        try {
          const supabase = useNuxtApp().$supabase
          const { data: threads, error: tErr } = await supabase
            .from('forum_threads')
            .select('*')
            .order('updated_at', { ascending: false })
          if (tErr) throw tErr

          const { data: replies, error: rErr } = await supabase
            .from('forum_replies')
            .select('*')
            .order('created_at')
          if (rErr) throw rErr

          this.threads = (threads || []) as ForumThread[]
          this.replies = (replies || []) as ForumReply[]
        } catch (err: any) {
          console.error('Failed to fetch forum from Supabase, falling back to demo:', err)
          this.isDemoMode = true
        } finally {
          this.loading = false
        }
      }

      if (this.isDemoMode) this._syncDemo()
      this.initialized = true
    },

    _syncDemo() {
      if (this.isDemoMode) {
        this.threads = [...DEMO_THREADS]
        this.replies = [...DEMO_REPLIES]
      }
    },

    /** Create a thread. Returns the new thread ID, or null on failure (see `error`). */
    async createThread(courseId: string, judul: string, konten: string, lessonId?: string | null): Promise<string | null> {
      const auth = useAuthStore()
      this.error = null
      if (!auth.user) return null

      const title = judul.trim()
      const body = konten.trim()
      if (!title || !body) {
        this.error = 'Judul dan isi diskusi harus diisi.'
        return null
      }
      if (title.length > THREAD_TITLE_MAX || body.length > POST_BODY_MAX) {
        this.error = `Judul maksimal ${THREAD_TITLE_MAX} karakter dan isi maksimal ${POST_BODY_MAX} karakter.`
        return null
      }

      const now = new Date().toISOString()

      if (this.isDemoMode) {
        const thread: ForumThread = {
          id: `ft-demo-${Date.now()}-${++demoSeq}`,
          course_id: courseId,
          lesson_id: lessonId || null,
          author_id: auth.user.id,
          judul: title,
          konten: body,
          is_pinned: false,
          is_locked: false,
          created_at: now,
          updated_at: now,
        }
        DEMO_THREADS.push(thread)
        this._syncDemo()
        return thread.id
      }

      try {
        const { data, error } = await useNuxtApp().$supabase
          .from('forum_threads')
          .insert({ course_id: courseId, lesson_id: lessonId || null, author_id: auth.user.id, judul: title, konten: body })
          .select()
          .single()
        if (error) throw error
        this.threads.unshift(data as ForumThread)
        return (data as ForumThread).id
      } catch (err: any) {
        this.error = err?.message || 'Gagal membuat diskusi.'
        return null
      }
    },

    /** Reply to a thread. Locked threads accept replies from moderators only. */
    async addReply(threadId: string, konten: string): Promise<boolean> {
      const auth = useAuthStore()
      this.error = null
      if (!auth.user) return false

      const thread = this.threads.find((t) => t.id === threadId)
      if (!thread) {
        this.error = 'Diskusi tidak ditemukan.'
        return false
      }
      if (thread.is_locked && !this.canModerate(thread.course_id)) {
        this.error = 'Diskusi ini sudah dikunci.'
        return false
      }

      const body = konten.trim()
      if (!body) {
        this.error = 'Balasan tidak boleh kosong.'
        return false
      }
      if (body.length > POST_BODY_MAX) {
        this.error = `Balasan maksimal ${POST_BODY_MAX} karakter.`
        return false
      }

      const now = new Date().toISOString()

      if (this.isDemoMode) {
        DEMO_REPLIES.push({
          id: `fr-demo-${Date.now()}-${++demoSeq}`,
          thread_id: threadId,
          author_id: auth.user.id,
          konten: body,
          is_answer: false,
          created_at: now,
        })
        const idx = DEMO_THREADS.findIndex((t) => t.id === threadId)
        if (idx >= 0) DEMO_THREADS[idx] = { ...DEMO_THREADS[idx], updated_at: now }
        this._syncDemo()

        // Demo: notify the thread author (production uses a Postgres trigger).
        const authorRole = this.authorInfo(thread.author_id).role
        const base = authorRole === 'student' ? '/courses' : '/instructor/courses'
        useNotificationsStore().notifyUsers([thread.author_id], {
          tipe: 'forum',
          judul: `${auth.user.nama} membalas diskusi Anda`,
          pesan: thread.judul,
          link: `${base}/${thread.course_id}/forum/${thread.id}`,
        })
        return true
      }

      try {
        const { data, error } = await useNuxtApp().$supabase
          .from('forum_replies')
          .insert({ thread_id: threadId, author_id: auth.user.id, konten: body })
          .select()
          .single()
        if (error) throw error
        this.replies.push(data as ForumReply)
        thread.updated_at = now
        return true
      } catch (err: any) {
        this.error = err?.message || 'Gagal mengirim balasan.'
        return false
      }
    },

    /** Delete a thread — author or moderator. */
    async deleteThread(threadId: string): Promise<boolean> {
      const auth = useAuthStore()
      const thread = this.threads.find((t) => t.id === threadId)
      if (!thread || !auth.user) return false
      if (thread.author_id !== auth.user.id && !this.canModerate(thread.course_id)) return false

      if (this.isDemoMode) {
        const idx = DEMO_THREADS.findIndex((t) => t.id === threadId)
        if (idx >= 0) DEMO_THREADS.splice(idx, 1)
        for (let i = DEMO_REPLIES.length - 1; i >= 0; i--) {
          if (DEMO_REPLIES[i].thread_id === threadId) DEMO_REPLIES.splice(i, 1)
        }
        this._syncDemo()
        return true
      }

      try {
        const { error } = await useNuxtApp().$supabase.from('forum_threads').delete().eq('id', threadId)
        if (error) throw error
        this.threads = this.threads.filter((t) => t.id !== threadId)
        this.replies = this.replies.filter((r) => r.thread_id !== threadId)
        return true
      } catch (err: any) {
        this.error = err?.message || 'Gagal menghapus diskusi.'
        return false
      }
    },

    /** Delete a reply — author or moderator. */
    async deleteReply(replyId: string): Promise<boolean> {
      const auth = useAuthStore()
      const reply = this.replies.find((r) => r.id === replyId)
      if (!reply || !auth.user) return false
      const thread = this.threads.find((t) => t.id === reply.thread_id)
      if (reply.author_id !== auth.user.id && !(thread && this.canModerate(thread.course_id))) return false

      if (this.isDemoMode) {
        const idx = DEMO_REPLIES.findIndex((r) => r.id === replyId)
        if (idx >= 0) DEMO_REPLIES.splice(idx, 1)
        this._syncDemo()
        return true
      }

      try {
        const { error } = await useNuxtApp().$supabase.from('forum_replies').delete().eq('id', replyId)
        if (error) throw error
        this.replies = this.replies.filter((r) => r.id !== replyId)
        return true
      } catch (err: any) {
        this.error = err?.message || 'Gagal menghapus balasan.'
        return false
      }
    },

    /** Moderator: update pin/lock flags of a thread. */
    async updateThreadFlags(threadId: string, flags: Partial<Pick<ForumThread, 'is_pinned' | 'is_locked'>>): Promise<boolean> {
      const thread = this.threads.find((t) => t.id === threadId)
      if (!thread || !this.canModerate(thread.course_id)) return false

      if (this.isDemoMode) {
        const idx = DEMO_THREADS.findIndex((t) => t.id === threadId)
        if (idx >= 0) DEMO_THREADS[idx] = { ...DEMO_THREADS[idx], ...flags }
        this._syncDemo()
        return true
      }

      try {
        const { error } = await useNuxtApp().$supabase.from('forum_threads').update(flags).eq('id', threadId)
        if (error) throw error
        Object.assign(thread, flags)
        return true
      } catch (err: any) {
        this.error = err?.message || 'Gagal memperbarui diskusi.'
        return false
      }
    },

    togglePin(threadId: string) {
      const t = this.threads.find((x) => x.id === threadId)
      return t ? this.updateThreadFlags(threadId, { is_pinned: !t.is_pinned }) : Promise.resolve(false)
    },

    toggleLock(threadId: string) {
      const t = this.threads.find((x) => x.id === threadId)
      return t ? this.updateThreadFlags(threadId, { is_locked: !t.is_locked }) : Promise.resolve(false)
    },

    /** Moderator: mark / unmark a reply as the answer. */
    async setAnswer(replyId: string, isAnswer: boolean): Promise<boolean> {
      const reply = this.replies.find((r) => r.id === replyId)
      if (!reply) return false
      const thread = this.threads.find((t) => t.id === reply.thread_id)
      if (!thread || !this.canModerate(thread.course_id)) return false

      if (this.isDemoMode) {
        const idx = DEMO_REPLIES.findIndex((r) => r.id === replyId)
        if (idx >= 0) DEMO_REPLIES[idx] = { ...DEMO_REPLIES[idx], is_answer: isAnswer }
        this._syncDemo()
        return true
      }

      try {
        const { error } = await useNuxtApp().$supabase.from('forum_replies').update({ is_answer: isAnswer }).eq('id', replyId)
        if (error) throw error
        reply.is_answer = isAnswer
        return true
      } catch (err: any) {
        this.error = err?.message || 'Gagal menandai jawaban.'
        return false
      }
    },
  },
})
