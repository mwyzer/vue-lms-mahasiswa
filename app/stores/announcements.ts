/**
 * Announcements Store — Manages course announcements data.
 *
 * Features:
 * - Fetch announcements by course
 * - Create announcements (instructors)
 * - Delete announcements (instructors)
 * - Demo mode + Supabase production mode
 */
import { defineStore } from 'pinia'
import type { Announcement } from '~/types/database'
import { useAuthStore } from './auth'

// ── Demo data (fallback when demoMode=true) ──────────
const DEMO_ANNOUNCEMENTS: Announcement[] = [
  { id: 'ann1', course_id: 'c1', instructor_id: 'i1', judul: 'Selamat Datang di Pemrograman Dasar', konten: 'Selamat datang mahasiswa! Silakan pelajari materi pertemuan pertama tentang pengantar pemrograman. Tugas pertama akan dibuka minggu depan.', created_at: '2025-08-01T08:00:00Z', updated_at: '2025-08-01T08:00:00Z' },
  { id: 'ann2', course_id: 'c1', instructor_id: 'i1', judul: 'Perubahan Jadwal Kelas', konten: 'Diberitahukan bahwa pertemuan minggu depan diliburkan karena hari libur nasional. Pertemuan akan dijadwalkan ulang.', created_at: '2025-08-10T10:00:00Z', updated_at: '2025-08-10T10:00:00Z' },
  { id: 'ann3', course_id: 'c2', instructor_id: 'i2', judul: 'Materi Tambahan Matematika Diskrit', konten: 'Silakan unduh materi tambahan tentang himpunan yang sudah diunggah di bagian materi.', created_at: '2025-08-05T09:00:00Z', updated_at: '2025-08-05T09:00:00Z' },
  { id: 'ann4', course_id: 'c5', instructor_id: 'i1', judul: 'Pengumuman Tugas Struktur Data', konten: 'Tugas 1 tentang Implementasi Array sudah tersedia. Deadline: 1 September 2025.', created_at: '2025-08-15T07:00:00Z', updated_at: '2025-08-15T07:00:00Z' },
  { id: 'ann5', course_id: 'c8', instructor_id: 'i1', judul: 'Persiapan UTS', konten: 'UTS Pemrograman Berorientasi Objek akan dilaksanakan pada pertemuan ke-8. Silakan persiapkan materi dari pertemuan 1-7.', created_at: '2025-08-20T11:00:00Z', updated_at: '2025-08-20T11:00:00Z' },
  { id: 'ann6', course_id: 'c11', instructor_id: 'i1', judul: 'Info Kelompok Proyek', konten: 'Untuk tugas akhir semester, mahasiswa akan dibagi dalam kelompok yang terdiri dari 3 orang. Silakan cari anggota kelompok masing-masing.', created_at: '2025-08-12T08:30:00Z', updated_at: '2025-08-12T08:30:00Z' },
]

interface AnnouncementsState {
  announcements: Announcement[]
  loading: boolean
  error: string | null
  isDemoMode: boolean
  initialized: boolean
  sbAnnouncements: Announcement[]
}

export const useAnnouncementsStore = defineStore('announcements', {
  state: (): AnnouncementsState => ({
    announcements: [],
    loading: false,
    error: null,
    isDemoMode: true,
    initialized: false,
    sbAnnouncements: [],
  }),

  getters: {
    /** All announcements for the current student's enrolled courses */
    myAnnouncements(state): Announcement[] {
      const auth = useAuthStore()
      const user = auth.user
      if (!user) return []

      if (state.isDemoMode) {
        // In demo mode, filter announcements by enrolled courses
        // The DEMO_ENROLLMENTS in courses store maps student IDs to course IDs
        // Import is not needed since we use the student's level/session to match
        if (user.role === 'student') {
          return state.announcements.filter((a) => {
            // Show announcements from all courses at the student's level/session
            // This is a simplification for demo mode
            return true // Show all announcements to all students in demo mode
          }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        }
        // Instructors see announcements they created
        if (user.role === 'instructor') {
          return state.announcements
            .filter((a) => a.instructor_id === user.id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        }
        // Admin sees all
        return state.announcements
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      }

      return state.sbAnnouncements
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    },

    /** Announcements for a specific course */
    announcementsByCourse: (state) => {
      return (courseId: string): Announcement[] => {
        const source = state.isDemoMode ? state.announcements : state.sbAnnouncements
        return source
          .filter((a) => a.course_id === courseId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      }
    },

    /** Recent announcements (last 3) for dashboard */
    recentAnnouncements(): Announcement[] {
      const auth = useAuthStore()
      // For demo mode students, show the 3 most recent announcements
      if (this.isDemoMode && auth.user?.role === 'student') {
        return this.announcements
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 3)
      }
      return this.myAnnouncements.slice(0, 3)
    },

    /** Instructor's course names for announcement context */
    instructorCourseNames(): Record<string, string> {
      // Use the course store to get names
      // This is a lightweight getter for display
      return {}
    },
  },

  actions: {
    async init() {
      if (this.initialized) return
      this.loading = true
      this.error = null

      try {
        const ui = useUiStore()
        this.isDemoMode = ui.isDemoMode

        if (this.isDemoMode) {
          this.announcements = [...DEMO_ANNOUNCEMENTS]
        } else {
          // Production: fetch from Supabase
          // TODO: Implement Supabase fetch when Supabase is configured
          this.announcements = []
        }
      } catch (err: any) {
        this.error = err.message || 'Gagal memuat pengumuman.'
        if (this.isDemoMode) {
          this.announcements = [...DEMO_ANNOUNCEMENTS]
        }
      } finally {
        this.loading = false
        this.initialized = true
      }
    },

    /** Instructor: Create a new announcement for a course */
    async createAnnouncement(courseId: string, judul: string, konten: string): Promise<boolean> {
      const auth = useAuthStore()
      if (!auth.user) return false

      this.loading = true
      this.error = null

      try {
        if (this.isDemoMode) {
          const newAnn: Announcement = {
            id: `ann_demo_${Date.now()}`,
            course_id: courseId,
            instructor_id: auth.user.id,
            judul: judul.trim(),
            konten: konten.trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          this.announcements.unshift(newAnn)
          return true
        }
        // TODO: Implement Supabase insert
        return false
      } catch (err: any) {
        this.error = err.message || 'Gagal membuat pengumuman.'
        return false
      } finally {
        this.loading = false
      }
    },

    /** Instructor: Delete an announcement */
    async deleteAnnouncement(announcementId: string): Promise<boolean> {
      this.loading = true
      this.error = null

      try {
        if (this.isDemoMode) {
          this.announcements = this.announcements.filter((a) => a.id !== announcementId)
          return true
        }
        // TODO: Implement Supabase delete
        return false
      } catch (err: any) {
        this.error = err.message || 'Gagal menghapus pengumuman.'
        return false
      } finally {
        this.loading = false
      }
    },
  },
})
