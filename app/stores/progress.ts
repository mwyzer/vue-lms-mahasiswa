/**
 * Progress Store — learning streak, badges, per-course progress, certificates
 * (Prioritas 3 · W2).
 *
 * Activities come from two places and are merged (deduplicated by type + ref):
 *   1. derived from the other stores' data (lesson progress, quiz attempts,
 *      submissions, forum posts) — so history that already exists counts;
 *   2. an explicit log (`record()`), e.g. flashcard reviews, plus a copy of
 *      every event observed live via Pinia `$onAction` on the source stores.
 *      Demo: persisted in localStorage per user. Production: `user_activity`.
 *
 * Badge rules live in app/data/badges.ts and are evaluated by the pure
 * functions in app/lib/progress.ts. Newly earned badges are stored
 * (`user_badges` / localStorage) and announced through the notifications store
 * (demo: `notifySelf`; production: a DB trigger inserts the notification).
 *
 * Other features can log activity with:
 *   useProgressStore().record('flashcard_reviewed', deckId, courseId, { count: 12 })
 */
import { defineStore } from 'pinia'
import { BADGES, type BadgeDefinition } from '~/data/badges'
import {
  activityHeatmap,
  badgeProgress,
  computeStats,
  computeStreak,
  evaluateBadges,
  type Activity,
  type ActivityStats,
  type ActivityType,
  type StreakResult,
} from '~/lib/progress'
import { buildCertificatePdf, certificateFileName, downloadPdf, makeVerificationCode } from '~/lib/certificate'
import { useAuthStore } from './auth'
import { useCoursesStore } from './courses'
import { useQuizStore } from './quiz'
import { useAssignmentsStore } from './assignments'
import { useForumStore } from './forum'
import { useNotificationsStore } from './notifications'
import { useUiStore } from './ui'

export interface EarnedBadge {
  badge_id: string
  earned_at: string
}

export interface CertificateRecord {
  course_id: string
  verification_code: string
  issued_at: string
}

export interface CourseProgressRow {
  course_id: string
  kode: string
  nama: string
  icon: string
  color: string
  lessonCount: number
  completedLessons: number
  percent: number
  quizzesDone: number
  quizzesTotal: number
  assignmentsDone: number
  assignmentsTotal: number
  completed: boolean
  certificate: CertificateRecord | null
}

export interface BadgeView extends BadgeDefinition {
  earned: boolean
  earned_at: string | null
  progress: { value: number; target: number; percent: number }
}

const STORAGE_PREFIX = 'lms-progress-v1:'
const MAX_LOG = 2000

interface PersistedProgress {
  logged: Activity[]
  earned: EarnedBadge[]
  certificates: CertificateRecord[]
}

interface ProgressState {
  userId: string | null
  logged: Activity[]
  earned: EarnedBadge[]
  certificates: CertificateRecord[]
  initialized: boolean
  loading: boolean
  isDemoMode: boolean
  error: string | null
}

let seq = 0
let initPromise: Promise<void> | null = null
let unsubscribers: Array<() => void> = []
/** Store instance the subscriptions belong to (a new Pinia — e.g. in tests — re-subscribes). */
let observedStore: object | null = null

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(++seq).toString(36)}`
}

/** Demo-only seed so the streak/badges have something to show for the first demo students. */
function demoSeed(userId: string, now = Date.now()): Activity[] {
  const days = userId === 's1' ? 5 : userId === 's2' ? 2 : 0
  const out: Activity[] = []
  for (let i = 1; i <= days; i++) {
    out.push({
      id: `seed-${userId}-${i}`,
      user_id: userId,
      tipe: 'flashcard_reviewed',
      ref_id: null,
      course_id: null,
      meta: { count: 8, seed: true },
      created_at: new Date(now - i * 86_400_000).toISOString(),
    })
  }
  return out
}

function readLocal(userId: string): PersistedProgress | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId)
    if (!raw) return null
    const v = JSON.parse(raw)
    return {
      logged: Array.isArray(v?.logged) ? v.logged : [],
      earned: Array.isArray(v?.earned) ? v.earned : [],
      certificates: Array.isArray(v?.certificates) ? v.certificates : [],
    }
  } catch {
    return null
  }
}

function writeLocal(userId: string, data: PersistedProgress): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(data))
  } catch {
    /* quota / private mode — keep in memory only */
  }
}

export const useProgressStore = defineStore('progress', {
  state: (): ProgressState => ({
    userId: null,
    logged: [],
    earned: [],
    certificates: [],
    initialized: false,
    loading: false,
    isDemoMode: true,
    error: null,
  }),

  getters: {
    /** Activities derived from the other stores for the signed-in student. */
    derivedActivities(): Activity[] {
      const auth = useAuthStore()
      const uid = auth.user?.id
      if (!uid || !auth.isStudent) return []
      const courses = useCoursesStore()
      const quiz = useQuizStore()
      const assignments = useAssignmentsStore()
      const forum = useForumStore()
      const out: Activity[] = []

      const lessonCourse = new Map<string, string>()
      for (const c of courses.myCourses) {
        for (const l of courses.lessonsByCourse(c.id)) lessonCourse.set(l.id, c.id)
      }
      for (const p of courses.lessonProgressFor(uid)) {
        if (!p.completed || !p.completed_at) continue
        out.push({ id: `lp-${p.id}`, user_id: uid, tipe: 'lesson_completed', ref_id: p.lesson_id, course_id: lessonCourse.get(p.lesson_id) ?? null, meta: null, created_at: p.completed_at })
      }

      const quizCourse = new Map(quiz.quizzes.map((q) => [q.id, q.course_id]))
      for (const a of quiz.attempts) {
        if (a.student_id !== uid || !a.submitted_at) continue
        out.push({ id: `qa-${a.id}`, user_id: uid, tipe: 'quiz_submitted', ref_id: a.quiz_id, course_id: quizCourse.get(a.quiz_id) ?? null, meta: { percentage: a.percentage }, created_at: a.submitted_at })
      }

      for (const a of assignments.myAssignments) {
        const s = a.submission
        if (!s?.submitted_at) continue
        out.push({ id: `sub-${s.id}`, user_id: uid, tipe: 'assignment_submitted', ref_id: a.id, course_id: a.course_id, meta: null, created_at: s.submitted_at })
      }

      const threadCourse = new Map(forum.threads.map((t) => [t.id, t.course_id]))
      for (const t of forum.threads) {
        if (t.author_id === uid) out.push({ id: `ft-${t.id}`, user_id: uid, tipe: 'forum_post', ref_id: t.id, course_id: t.course_id, meta: null, created_at: t.created_at })
      }
      for (const r of forum.replies) {
        if (r.author_id === uid) out.push({ id: `fr-${r.id}`, user_id: uid, tipe: 'forum_post', ref_id: r.id, course_id: threadCourse.get(r.thread_id) ?? null, meta: null, created_at: r.created_at })
      }
      return out
    },

    /** Derived + logged activities, newest first (duplicates by type+ref collapse to the earliest). */
    activities(): Activity[] {
      const all = [...this.derivedActivities, ...this.logged.filter((a) => a.user_id === this.userId)]
      const byKey = new Map<string, Activity>()
      const extras: Activity[] = []
      for (const a of all) {
        if (a.tipe === 'flashcard_reviewed' || !a.ref_id) {
          extras.push(a)
          continue
        }
        const key = `${a.tipe}:${a.ref_id}`
        const prev = byKey.get(key)
        if (!prev) {
          byKey.set(key, a)
          continue
        }
        // Keep the earliest occurrence, but the best quiz score seen.
        const first = Date.parse(a.created_at) < Date.parse(prev.created_at) ? a : prev
        const pct = Math.max(Number(prev.meta?.percentage ?? -1), Number(a.meta?.percentage ?? -1))
        byKey.set(key, pct >= 0 ? { ...first, meta: { ...(first.meta ?? {}), percentage: pct } } : first)
      }
      return [...byKey.values(), ...extras].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    },

    courseProgress(): CourseProgressRow[] {
      const auth = useAuthStore()
      if (!auth.user || !auth.isStudent) return []
      const quiz = useQuizStore()
      const assignments = useAssignmentsStore().myAssignments
      const uid = auth.user.id
      return useCoursesStore().myCourses.map((c) => {
        const quizzes = quiz.quizzes.filter((q) => q.course_id === c.id && q.is_active)
        const done = new Set(quiz.attempts.filter((a) => a.student_id === uid).map((a) => a.quiz_id))
        const courseAssignments = assignments.filter((a) => a.course_id === c.id)
        const lessonCount = c.lessonCount ?? 0
        const completedLessons = c.completedLessons ?? 0
        const percent = c.progressPercent ?? 0
        return {
          course_id: c.id,
          kode: c.kode,
          nama: c.nama,
          icon: c.icon || '📚',
          color: c.color || '',
          lessonCount,
          completedLessons,
          percent,
          quizzesDone: quizzes.filter((q) => done.has(q.id)).length,
          quizzesTotal: quizzes.length,
          assignmentsDone: courseAssignments.filter((a) => a.submission).length,
          assignmentsTotal: courseAssignments.length,
          completed: lessonCount > 0 && completedLessons >= lessonCount,
          certificate: this.certificates.find((x) => x.course_id === c.id) ?? null,
        }
      })
    },

    stats(): ActivityStats {
      return computeStats(this.activities, { coursesCompleted: this.courseProgress.filter((c) => c.completed).length })
    },

    streak(): StreakResult {
      return computeStreak(this.activities.map((a) => a.created_at))
    },

    heatmap(): { day: string; count: number }[] {
      return activityHeatmap(this.activities, 28)
    },

    badges(): BadgeView[] {
      const stats = this.stats
      return BADGES.map((b) => {
        const e = this.earned.find((x) => x.badge_id === b.id)
        return { ...b, earned: !!e, earned_at: e?.earned_at ?? null, progress: badgeProgress(b, stats) }
      })
    },

    earnedBadges(): BadgeView[] {
      return this.badges
        .filter((b) => b.earned)
        .sort((a, b) => Date.parse(b.earned_at || '') - Date.parse(a.earned_at || ''))
    },
  },

  actions: {
    /** Load persisted progress for the current student and start observing source stores. */
    async init() {
      const auth = useAuthStore()
      const uid = auth.user?.id ?? null
      if (this.initialized && this.userId === uid) return
      if (initPromise) return initPromise
      initPromise = this._load(uid).finally(() => {
        initPromise = null
      })
      return initPromise
    },

    async _load(uid: string | null) {
      const auth = useAuthStore()
      this.isDemoMode = useUiStore().isDemoMode
      this.userId = uid
      this.logged = []
      this.earned = []
      this.certificates = []
      this.error = null
      if (!uid || !auth.isStudent) {
        this.initialized = true
        return
      }
      this.loading = true
      try {
        // Source stores (each init is idempotent).
        await useCoursesStore().init()
        await Promise.all([useQuizStore().init(), useAssignmentsStore().init(), useForumStore().init()])

        if (this.isDemoMode) {
          const saved = readLocal(uid)
          if (saved) {
            this.logged = saved.logged
            this.earned = saved.earned
            this.certificates = saved.certificates
          } else {
            this.logged = demoSeed(uid)
          }
        } else {
          await this._fetchRemote(uid)
        }
        this._observe()
        this.initialized = true
        await this.evaluate()
      } finally {
        this.loading = false
      }
    },

    async _fetchRemote(uid: string) {
      try {
        const supabase = useNuxtApp().$supabase
        const [act, bdg, cert] = await Promise.all([
          supabase.from('user_activity').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(MAX_LOG),
          supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', uid),
          supabase.from('certificates').select('course_id, verification_code, issued_at').eq('user_id', uid),
        ])
        if (act.error) throw act.error
        if (bdg.error) throw bdg.error
        if (cert.error) throw cert.error
        this.logged = (act.data || []) as Activity[]
        this.earned = (bdg.data || []) as EarnedBadge[]
        this.certificates = (cert.data || []) as CertificateRecord[]
      } catch (err: any) {
        // Migration not applied yet: still show derived progress, just without history/badges.
        console.error('Failed to load progress from Supabase:', err)
        this.error = err?.message || 'Gagal memuat progres.'
      }
    },

    /** Subscribe once to the actions that represent learning activity. */
    _observe() {
      const courses = useCoursesStore()
      if (observedStore === courses && unsubscribers.length) return
      for (const u of unsubscribers) u()
      unsubscribers = []
      observedStore = courses
      const auth = useAuthStore()
      const quiz = useQuizStore()
      const assignments = useAssignmentsStore()
      const forum = useForumStore()
      const onlyStudent = () => auth.isStudent && auth.user?.id === this.userId

      unsubscribers.push(
        courses.$onAction(({ name, args, after }) => {
          if (name !== 'markLessonCompleted' && name !== 'toggleLessonCompleted') return
          after(() => {
            if (!onlyStudent()) return
            const lessonId = String(args[0])
            const row = courses.lessonProgressFor(this.userId!).find((p) => p.lesson_id === lessonId)
            if (!row?.completed) return
            const courseId = courses.myCourses.find((c) => courses.lessonsByCourse(c.id).some((l) => l.id === lessonId))?.id ?? null
            this.record('lesson_completed', lessonId, courseId)
          })
        }, true),
        quiz.$onAction(({ name, after }) => {
          if (name !== 'submitQuiz') return
          after((attempt) => {
            if (!onlyStudent() || !attempt) return
            const a = attempt as { quiz_id: string; percentage: number }
            const courseId = quiz.quizzes.find((q) => q.id === a.quiz_id)?.course_id ?? null
            this.record('quiz_submitted', a.quiz_id, courseId, { percentage: a.percentage })
          })
        }, true),
        assignments.$onAction(({ name, args, after }) => {
          if (name !== 'submitAssignment') return
          after(() => {
            if (!onlyStudent()) return
            const id = String(args[0])
            const a = assignments.myAssignments.find((x) => x.id === id)
            if (!a?.submission) return
            this.record('assignment_submitted', id, a.course_id)
          })
        }, true),
        forum.$onAction(({ name, args, after }) => {
          if (name !== 'createThread' && name !== 'addReply') return
          after((result) => {
            if (!onlyStudent() || !result) return
            if (name === 'createThread') {
              this.record('forum_post', String(result), String(args[0]))
              return
            }
            const threadId = String(args[0])
            const mine = forum.replies
              .filter((r) => r.thread_id === threadId && r.author_id === this.userId)
              .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
            const courseId = forum.threads.find((t) => t.id === threadId)?.course_id ?? null
            if (mine) this.record('forum_post', mine.id, courseId)
          })
        }, true),
      )
    },

    /** Log one learning activity for the signed-in student and re-evaluate badges. */
    async record(tipe: ActivityType, refId: string | null = null, courseId: string | null = null, meta: Record<string, unknown> | null = null) {
      const auth = useAuthStore()
      const uid = auth.user?.id
      if (!uid || !auth.isStudent) return null
      if (this.userId !== uid) await this.init()
      const activity: Activity = {
        id: newId('act'),
        user_id: uid,
        tipe,
        ref_id: refId,
        course_id: courseId,
        meta,
        created_at: new Date().toISOString(),
      }
      this.logged = [activity, ...this.logged].slice(0, MAX_LOG)

      if (this.isDemoMode) {
        this._persistLocal()
      } else {
        try {
          const supabase = useNuxtApp().$supabase
          const { error } = await supabase.from('user_activity').insert({
            user_id: uid,
            tipe,
            ref_id: refId,
            course_id: isUuidLike(courseId) ? courseId : null,
            meta,
          })
          if (error) throw error
        } catch (err) {
          console.error('Failed to save activity:', err)
        }
      }
      await this.evaluate()
      return activity
    },

    /**
     * Award newly qualifying badges and issue certificates for completed courses.
     * Returns the newly earned badges.
     */
    async evaluate(): Promise<BadgeDefinition[]> {
      const auth = useAuthStore()
      const uid = auth.user?.id
      if (!uid || !auth.isStudent || this.userId !== uid || !this.initialized) return []

      const fresh = evaluateBadges(BADGES, this.stats, this.earned.map((e) => e.badge_id))
      const now = new Date().toISOString()
      const notifications = useNotificationsStore()
      const ui = useUiStore()

      if (fresh.length) {
        this.earned = [...this.earned, ...fresh.map((b) => ({ badge_id: b.id, earned_at: now }))]
        for (const b of fresh) {
          notifications.notifySelf({
            tipe: 'sistem',
            judul: `Badge baru: ${b.icon} ${b.nama}`,
            pesan: b.deskripsi,
            link: '/student/progress',
            dedupe_key: `badge:${b.id}`,
          })
        }
        // Production toasts arrive through notifications realtime; demo shows one here.
        if (this.isDemoMode) {
          ui.showToast('success', fresh.length === 1 ? `🏅 Badge baru: ${fresh[0]!.nama}` : `🏅 ${fresh.length} badge baru didapat!`)
        }
        if (!this.isDemoMode) {
          try {
            const { error } = await useNuxtApp().$supabase
              .from('user_badges')
              .upsert(fresh.map((b) => ({ user_id: uid, badge_id: b.id })), { onConflict: 'user_id,badge_id', ignoreDuplicates: true })
            if (error) throw error
          } catch (err) {
            console.error('Failed to save badges:', err)
          }
        }
      }

      const newCerts = await this._issueCertificates(uid)
      if (this.isDemoMode && (fresh.length || newCerts)) this._persistLocal()
      return fresh
    },

    async _issueCertificates(uid: string): Promise<number> {
      const courses = useCoursesStore()
      const completed = this.courseProgress.filter((c) => c.completed && !c.certificate)
      if (!completed.length) return 0
      const progress = courses.lessonProgressFor(uid)
      const created: CertificateRecord[] = []
      for (const c of completed) {
        const lessonIds = new Set(courses.lessonsByCourse(c.course_id).map((l) => l.id))
        const last = progress
          .filter((p) => lessonIds.has(p.lesson_id) && p.completed_at)
          .map((p) => Date.parse(p.completed_at!))
          .filter(Number.isFinite)
          .sort((a, b) => b - a)[0]
        const issuedAt = new Date(last ?? Date.now()).toISOString()
        created.push({ course_id: c.course_id, issued_at: issuedAt, verification_code: makeVerificationCode(uid, c.course_id, issuedAt) })
        useNotificationsStore().notifySelf({
          tipe: 'sistem',
          judul: `Sertifikat siap: ${c.kode} ${c.nama}`,
          pesan: 'Selamat! Seluruh materi selesai. Unduh sertifikat Anda di halaman Progres.',
          link: '/student/progress',
          dedupe_key: `certificate:${c.course_id}`,
        })
      }
      this.certificates = [...this.certificates, ...created]
      if (!this.isDemoMode) {
        try {
          const rows = created.filter((c) => isUuidLike(c.course_id)).map((c) => ({ user_id: uid, ...c }))
          if (rows.length) {
            const { error } = await useNuxtApp().$supabase
              .from('certificates')
              .upsert(rows, { onConflict: 'user_id,course_id', ignoreDuplicates: true })
            if (error) throw error
          }
        } catch (err) {
          console.error('Failed to save certificates:', err)
        }
      }
      return created.length
    },

    /** Build and download the certificate PDF for a completed course. */
    async downloadCertificate(courseId: string): Promise<boolean> {
      const auth = useAuthStore()
      const row = this.courseProgress.find((c) => c.course_id === courseId)
      // A certificate, once issued, stays downloadable (demo lesson progress resets on reload).
      if (!auth.user || !row || (!row.completed && !row.certificate)) {
        useUiStore().showToast('warning', 'Sertifikat tersedia setelah semua materi selesai.')
        return false
      }
      if (!row.certificate) await this.evaluate()
      const cert = this.certificates.find((c) => c.course_id === courseId)
      if (!cert) return false
      try {
        const config = useRuntimeConfig()
        const data = {
          studentName: auth.user.nama || 'Mahasiswa',
          studentNpm: auth.user.npm ?? null,
          courseName: row.nama,
          courseCode: row.kode,
          issuedAt: cert.issued_at,
          verificationCode: cert.verification_code,
          appName: String(config.public.appName || 'LMS Mahasiswa'),
        }
        const bytes = await buildCertificatePdf(data)
        downloadPdf(bytes, certificateFileName(data))
        return true
      } catch (err) {
        console.error('Failed to build certificate:', err)
        useUiStore().showToast('error', 'Gagal membuat sertifikat PDF.')
        return false
      }
    },

    _persistLocal() {
      if (!this.userId) return
      writeLocal(this.userId, { logged: this.logged, earned: this.earned, certificates: this.certificates })
    },

    /** Clear local state (logout) and stop observing. */
    reset() {
      for (const u of unsubscribers) u()
      unsubscribers = []
      observedStore = null
      this.userId = null
      this.logged = []
      this.earned = []
      this.certificates = []
      this.initialized = false
    },
  },
})

function isUuidLike(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}
