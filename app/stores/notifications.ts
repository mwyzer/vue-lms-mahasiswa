/**
 * Notifications Store — in-app notification center.
 *
 * Features:
 * - Per-user notification list with unread count
 * - Mark as read / mark all read / delete
 * - Deadline reminders for unsubmitted assignments
 * - Demo mode: notifications are produced client-side by the other stores
 *   (new assignment, grade, announcement, forum reply) and kept in memory
 * - Production: rows are created by Postgres triggers + the deadline cron
 *   (see supabase/migration-prioritas-1.sql) and pushed via Supabase Realtime
 */
import { defineStore } from 'pinia'
import type { AppNotification, NotificationType } from '~/types/database'
import { useAuthStore } from './auth'
import { useCoursesStore } from './courses'
import { useAssignmentsStore } from './assignments'

export interface NotificationPayload {
  tipe: NotificationType
  judul: string
  pesan?: string | null
  link?: string | null
  dedupe_key?: string | null
}

/** Window (hours) before a deadline in which a reminder is raised. */
export const DEADLINE_REMINDER_HOURS = 24

const MAX_ITEMS = 50

// ── Demo data (shared across demo logins within one browser session) ──
const DEMO_NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', user_id: 's1', tipe: 'nilai', judul: 'Nilai keluar: Tugas 1: Hello World', pesan: 'Nilai Anda: 90', link: '/assignments/a1', read_at: null, created_at: '2025-08-15T08:00:00Z' },
  { id: 'n2', user_id: 's1', tipe: 'pengumuman', judul: 'Pengumuman: Perubahan Jadwal Kelas', pesan: 'Pertemuan minggu depan diliburkan karena hari libur nasional.', link: '/courses/c1', read_at: '2025-08-10T12:00:00Z', created_at: '2025-08-10T10:00:00Z' },
  { id: 'n3', user_id: 'i1', tipe: 'sistem', judul: 'Selamat datang di pusat notifikasi', pesan: 'Balasan forum dan aktivitas kelas akan muncul di sini.', link: null, read_at: null, created_at: '2025-08-01T08:00:00Z' },
]

let demoSeq = 0

function newestFirst(a: AppNotification, b: AppNotification): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

interface NotificationsState {
  items: AppNotification[]
  loading: boolean
  error: string | null
  isDemoMode: boolean
  initialized: boolean
  /** User the Supabase list + realtime channel were loaded for. */
  loadedForUserId: string | null
}

// Realtime channel is kept outside state (not serializable / not reactive).
let realtimeChannel: { unsubscribe: () => unknown } | null = null

export const useNotificationsStore = defineStore('notifications', {
  state: (): NotificationsState => ({
    items: [],
    loading: false,
    error: null,
    isDemoMode: true,
    initialized: false,
    loadedForUserId: null,
  }),

  getters: {
    /** Notifications for the signed-in user, newest first. */
    mine(state): AppNotification[] {
      const auth = useAuthStore()
      const uid = auth.user?.id
      if (!uid) return []
      return state.items.filter((n) => n.user_id === uid).sort(newestFirst).slice(0, MAX_ITEMS)
    },

    unreadCount(): number {
      return this.mine.filter((n) => !n.read_at).length
    },
  },

  actions: {
    /**
     * Load notifications for the current user. Safe to call repeatedly —
     * reloads only when the signed-in user changed.
     */
    async init() {
      const auth = useAuthStore()
      const ui = useUiStore()
      const uid = auth.user?.id ?? null

      if (this.initialized && this.loadedForUserId === uid) return
      this.isDemoMode = ui.isDemoMode
      this.error = null

      if (!this.isDemoMode && uid) {
        this.loading = true
        try {
          const supabase = useNuxtApp().$supabase
          const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .limit(MAX_ITEMS)

          if (error) throw error
          this.items = (data || []) as AppNotification[]
          this.subscribeRealtime(uid)
        } catch (err: any) {
          // Table missing / RLS not applied yet — show an empty list instead of demo data.
          console.error('Failed to fetch notifications:', err)
          this.error = err?.message || 'Gagal memuat notifikasi.'
          this.items = []
        } finally {
          this.loading = false
        }
      }

      if (this.isDemoMode) {
        this.items = [...DEMO_NOTIFICATIONS]
      }

      this.loadedForUserId = uid
      this.initialized = true

      if (this.isDemoMode) this.syncDeadlineReminders()
    },

    /** Subscribe to new notification rows for this user (production only). */
    subscribeRealtime(userId: string) {
      this.unsubscribeRealtime()
      if (!import.meta.client) return
      try {
        const supabase = useNuxtApp().$supabase
        realtimeChannel = supabase
          .channel(`notifications:${userId}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
            (payload: { new: unknown }) => this.receive(payload.new as AppNotification)
          )
          .subscribe()
      } catch (err) {
        console.error('Failed to subscribe to notifications:', err)
      }
    },

    unsubscribeRealtime() {
      try { realtimeChannel?.unsubscribe() } catch { /* ignore */ }
      realtimeChannel = null
    },

    /** Handle a notification pushed by Realtime: add it and show a toast. */
    receive(n: AppNotification) {
      if (!n?.id || this.items.some((x) => x.id === n.id)) return
      this.items.unshift(n)
      useUiStore().showToast('info', n.judul)
    },

    /**
     * Demo mode: create a notification for each given user.
     * In production this is a no-op — Postgres triggers create the rows.
     * Returns the number of notifications created.
     * `includeSelf` also notifies the signed-in user (used for reminders).
     */
    notifyUsers(userIds: string[], payload: NotificationPayload, includeSelf = false): number {
      if (!useUiStore().isDemoMode) return 0
      const auth = useAuthStore()
      const actorId = auth.user?.id
      let created = 0

      for (const uid of new Set(userIds)) {
        if (!uid || (uid === actorId && !includeSelf)) continue
        if (payload.dedupe_key && DEMO_NOTIFICATIONS.some((n) => n.user_id === uid && n.dedupe_key === payload.dedupe_key)) {
          continue
        }
        DEMO_NOTIFICATIONS.push({
          id: `n-demo-${Date.now()}-${++demoSeq}`,
          user_id: uid,
          tipe: payload.tipe,
          judul: payload.judul,
          pesan: payload.pesan ?? null,
          link: payload.link ?? null,
          dedupe_key: payload.dedupe_key ?? null,
          read_at: null,
          created_at: new Date().toISOString(),
        })
        created++
      }

      if (created > 0 && this.isDemoMode) this.items = [...DEMO_NOTIFICATIONS]
      return created
    },

    /**
     * Demo mode: notify the signed-in user (e.g. a badge they just earned).
     * `notifyUsers` skips the actor, so self-notifications go through here.
     * In production this is a no-op — a Postgres trigger creates the row
     * (see supabase/migration-prioritas-3-w2.sql). Returns true if created.
     */
    notifySelf(payload: NotificationPayload): boolean {
      if (!useUiStore().isDemoMode) return false
      const uid = useAuthStore().user?.id
      if (!uid) return false
      if (payload.dedupe_key && DEMO_NOTIFICATIONS.some((n) => n.user_id === uid && n.dedupe_key === payload.dedupe_key)) {
        return false
      }
      DEMO_NOTIFICATIONS.push({
        id: `n-demo-${Date.now()}-${++demoSeq}`,
        user_id: uid,
        tipe: payload.tipe,
        judul: payload.judul,
        pesan: payload.pesan ?? null,
        link: payload.link ?? null,
        dedupe_key: payload.dedupe_key ?? null,
        read_at: null,
        created_at: new Date().toISOString(),
      })
      this.items = [...DEMO_NOTIFICATIONS]
      return true
    },

    /**
     * Demo mode: notify every student enrolled in a course
     * (same level + session roster lookup the rest of the app uses).
     */
    notifyCourseStudents(courseId: string, payload: NotificationPayload): number {
      if (!useUiStore().isDemoMode) return 0
      const auth = useAuthStore()
      const course = useCoursesStore().allCourses.find((c) => c.id === courseId)
      if (!course) return 0
      const ids = auth.studentRoster
        .filter((s) => s.level === course.level && s.session_time === course.session_time)
        .map((s) => s.id)
      return this.notifyUsers(ids, payload)
    },

    /**
     * Demo mode: raise a reminder for each of the current student's assignments
     * that is due within DEADLINE_REMINDER_HOURS and not yet submitted.
     * (Production uses the cron endpoint /api/cron/deadline-reminders.)
     */
    syncDeadlineReminders(now: number = Date.now()): number {
      const auth = useAuthStore()
      if (!useUiStore().isDemoMode || !auth.isStudent || !auth.user) return 0

      const windowMs = DEADLINE_REMINDER_HOURS * 60 * 60 * 1000
      const uid = auth.user.id
      let created = 0

      for (const a of useAssignmentsStore().myAssignments) {
        if (!a.tenggat_waktu || a.submission) continue
        const due = new Date(a.tenggat_waktu).getTime()
        if (Number.isNaN(due) || due <= now || due - now > windowMs) continue

        const key = `deadline:${a.id}`
        if (DEMO_NOTIFICATIONS.some((n) => n.user_id === uid && n.dedupe_key === key)) continue

        DEMO_NOTIFICATIONS.push({
          id: `n-demo-${Date.now()}-${++demoSeq}`,
          user_id: uid,
          tipe: 'deadline',
          judul: `Tenggat mendekat: ${a.judul}`,
          pesan: `Belum dikumpulkan · tenggat ${new Date(a.tenggat_waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}`,
          link: `/assignments/${a.id}`,
          dedupe_key: key,
          read_at: null,
          created_at: new Date(now).toISOString(),
        })
        created++
      }

      if (created > 0) this.items = [...DEMO_NOTIFICATIONS]
      return created
    },

    async markRead(id: string) {
      const item = this.items.find((n) => n.id === id)
      if (!item || item.read_at) return
      const readAt = new Date().toISOString()
      item.read_at = readAt

      if (this.isDemoMode) {
        const demo = DEMO_NOTIFICATIONS.find((n) => n.id === id)
        if (demo) demo.read_at = readAt
        return
      }
      try {
        await useNuxtApp().$supabase.from('notifications').update({ read_at: readAt }).eq('id', id)
      } catch (err) {
        console.error('Failed to mark notification read:', err)
      }
    },

    async markAllRead() {
      const uid = useAuthStore().user?.id
      if (!uid) return
      const readAt = new Date().toISOString()
      const unread = this.items.filter((n) => n.user_id === uid && !n.read_at)
      if (unread.length === 0) return
      for (const n of unread) n.read_at = readAt

      if (this.isDemoMode) {
        for (const n of DEMO_NOTIFICATIONS) {
          if (n.user_id === uid && !n.read_at) n.read_at = readAt
        }
        return
      }
      try {
        await useNuxtApp().$supabase
          .from('notifications')
          .update({ read_at: readAt })
          .eq('user_id', uid)
          .is('read_at', null)
      } catch (err) {
        console.error('Failed to mark all notifications read:', err)
      }
    },

    async remove(id: string) {
      this.items = this.items.filter((n) => n.id !== id)

      if (this.isDemoMode) {
        const idx = DEMO_NOTIFICATIONS.findIndex((n) => n.id === id)
        if (idx >= 0) DEMO_NOTIFICATIONS.splice(idx, 1)
        return
      }
      try {
        await useNuxtApp().$supabase.from('notifications').delete().eq('id', id)
      } catch (err) {
        console.error('Failed to delete notification:', err)
      }
    },

    /** Clear local state on logout. */
    reset() {
      this.unsubscribeRealtime()
      this.items = []
      this.loadedForUserId = null
      this.initialized = false
    },
  },
})
