/**
 * Calendar Store — Manages academic calendar events.
 * Follows the Pinia demo-data pattern from announcements store.
 */
import { defineStore } from 'pinia'
import type { AcademicEvent } from '~/types/database'
import type { AcademicEventWithCourse } from '~/types/calendar'

// ── Demo Academic Events ─────────────────────────────────────
const DEMO_EVENTS: AcademicEvent[] = [
  // UTS
  { id: 'ev1', course_id: 'c1', judul: 'UTS Algoritma & Pemrograman', deskripsi: 'Ujian Tengah Semester ganjil 2025/2026.', tanggal_mulai: '2025-10-06T08:00:00Z', tanggal_selesai: '2025-10-06T10:00:00Z', tipe: 'uts', color: '#ef4444', created_at: '2025-08-01T00:00:00Z', updated_at: '2025-08-01T00:00:00Z' },
  { id: 'ev2', course_id: 'c2', judul: 'UTS Struktur Data', deskripsi: 'Ujian Tengah Semester.', tanggal_mulai: '2025-10-07T08:00:00Z', tanggal_selesai: '2025-10-07T10:00:00Z', tipe: 'uts', color: '#ef4444', created_at: '2025-08-01T00:00:00Z', updated_at: '2025-08-01T00:00:00Z' },
  { id: 'ev3', course_id: 'c3', judul: 'UTS Basis Data', deskripsi: 'Ujian Tengah Semester.', tanggal_mulai: '2025-10-08T08:00:00Z', tanggal_selesai: '2025-10-08T10:00:00Z', tipe: 'uts', color: '#ef4444', created_at: '2025-08-01T00:00:00Z', updated_at: '2025-08-01T00:00:00Z' },
  // UAS
  { id: 'ev4', course_id: 'c1', judul: 'UAS Algoritma & Pemrograman', deskripsi: 'Ujian Akhir Semester ganjil 2025/2026.', tanggal_mulai: '2025-12-15T08:00:00Z', tanggal_selesai: '2025-12-15T10:00:00Z', tipe: 'uas', color: '#f59e0b', created_at: '2025-08-01T00:00:00Z', updated_at: '2025-08-01T00:00:00Z' },
  { id: 'ev5', course_id: 'c2', judul: 'UAS Struktur Data', deskripsi: 'Ujian Akhir Semester.', tanggal_mulai: '2025-12-16T08:00:00Z', tanggal_selesai: '2025-12-16T10:00:00Z', tipe: 'uas', color: '#f59e0b', created_at: '2025-08-01T00:00:00Z', updated_at: '2025-08-01T00:00:00Z' },
  { id: 'ev6', course_id: 'c3', judul: 'UAS Basis Data', deskripsi: 'Ujian Akhir Semester.', tanggal_mulai: '2025-12-17T08:00:00Z', tanggal_selesai: '2025-12-17T10:00:00Z', tipe: 'uas', color: '#f59e0b', created_at: '2025-08-01T00:00:00Z', updated_at: '2025-08-01T00:00:00Z' },
  // Tugas deadlines
  { id: 'ev7', course_id: 'c1', judul: 'Tugas 1 Algoritma', deskripsi: 'Buat program kalkulator sederhana.', tanggal_mulai: '2025-09-20T23:59:00Z', tanggal_selesai: '2025-09-20T23:59:00Z', tipe: 'tugas', color: '#3b82f6', created_at: '2025-08-15T00:00:00Z', updated_at: '2025-08-15T00:00:00Z' },
  { id: 'ev8', course_id: 'c1', judul: 'Tugas 2 Algoritma', deskripsi: 'Implementasi sorting algorithm.', tanggal_mulai: '2025-10-15T23:59:00Z', tanggal_selesai: '2025-10-15T23:59:00Z', tipe: 'tugas', color: '#3b82f6', created_at: '2025-08-15T00:00:00Z', updated_at: '2025-08-15T00:00:00Z' },
  // Holidays
  { id: 'ev9', course_id: null, judul: 'Libur Nasional — Hari Kemerdekaan', deskripsi: 'Hari Kemerdekaan RI.', tanggal_mulai: '2025-08-17T00:00:00Z', tanggal_selesai: '2025-08-17T23:59:00Z', tipe: 'libur', color: '#8b5cf6', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
  { id: 'ev10', course_id: null, judul: 'Libur Semester Ganjil', deskripsi: 'Libur akhir semester ganjil.', tanggal_mulai: '2025-12-22T00:00:00Z', tanggal_selesai: '2026-01-05T23:59:00Z', tipe: 'libur', color: '#8b5cf6', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
  // Academic events
  { id: 'ev11', course_id: null, judul: 'Pengumuman Kalender Akademik', deskripsi: 'Kalender akademik tahun ajaran 2025/2026 telah diterbitkan.', tanggal_mulai: '2025-08-01T00:00:00Z', tanggal_selesai: '2025-08-01T23:59:00Z', tipe: 'acara', color: '#06b6d4', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
  { id: 'ev12', course_id: 'c2', judul: 'Tugas 1 Struktur Data', deskripsi: 'Buat implementasi linked list.', tanggal_mulai: '2025-09-25T23:59:00Z', tanggal_selesai: '2025-09-25T23:59:00Z', tipe: 'tugas', color: '#3b82f6', created_at: '2025-08-15T00:00:00Z', updated_at: '2025-08-15T00:00:00Z' },
  // Additional events to fill the calendar
  { id: 'ev13', course_id: 'c1', judul: 'Kuis 1 Algoritma', deskripsi: 'Kuis variabel dan tipe data.', tanggal_mulai: '2025-09-11T08:00:00Z', tanggal_selesai: '2025-09-11T08:15:00Z', tipe: 'tugas', color: '#3b82f6', created_at: '2025-08-10T00:00:00Z', updated_at: '2025-08-10T00:00:00Z' },
  { id: 'ev14', course_id: 'c3', judul: 'Kuis SQL', deskripsi: 'Kuis query SQL dasar.', tanggal_mulai: '2025-09-21T10:00:00Z', tanggal_selesai: '2025-09-21T10:20:00Z', tipe: 'tugas', color: '#3b82f6', created_at: '2025-08-10T00:00:00Z', updated_at: '2025-08-10T00:00:00Z' },
]

export const useCalendarStore = defineStore('calendar', {
  state: () => ({
    isDemoMode: true,
    initialized: false,
    loading: false,
    error: null as string | null,
    demoVersion: 0,
    events: [] as AcademicEvent[],
  }),

  getters: {
    /** All events with course info */
    allEvents(): AcademicEventWithCourse[] {
      const courseNames: Record<string, string> = {
        c1: 'Algoritma & Pemrograman',
        c2: 'Struktur Data',
        c3: 'Basis Data',
        c4: 'Pemrograman Web',
        c5: 'Jaringan Komputer',
      }
      return this.events.map(e => ({
        ...e,
        course_name: e.course_id ? courseNames[e.course_id] || e.course_id : undefined,
        course_kode: e.course_id ? `IF${e.course_id.replace('c', '')}${parseInt(e.course_id.replace('c', '')) * 10}` : undefined,
      }))
    },

    /** Events for a specific month (0-indexed) */
    eventsByMonth(): (year: number, month: number) => AcademicEventWithCourse[] {
      return (year: number, month: number) =>
        this.allEvents.filter(e => {
          const start = new Date(e.tanggal_mulai)
          return start.getFullYear() === year && start.getMonth() === month
        }).sort((a, b) => new Date(a.tanggal_mulai).getTime() - new Date(b.tanggal_mulai).getTime())
    },

    /** Events for a specific course */
    eventsByCourse(): (courseId: string) => AcademicEventWithCourse[] {
      return (courseId: string) =>
        this.allEvents.filter(e => e.course_id === courseId)
          .sort((a, b) => new Date(a.tanggal_mulai).getTime() - new Date(b.tanggal_mulai).getTime())
    },

    /** Events filtered by type */
    eventsByType(): (tipe: AcademicEvent['tipe']) => AcademicEventWithCourse[] {
      return (tipe) =>
        this.allEvents.filter(e => e.tipe === tipe)
          .sort((a, b) => new Date(a.tanggal_mulai).getTime() - new Date(b.tanggal_mulai).getTime())
    },

    /** Upcoming events (from today onwards) */
    upcomingEvents(): AcademicEventWithCourse[] {
      const now = new Date().toISOString()
      return this.allEvents
        .filter(e => e.tanggal_selesai >= now)
        .sort((a, b) => new Date(a.tanggal_mulai).getTime() - new Date(b.tanggal_mulai).getTime())
        .slice(0, 10)
    },

    /** Events happening today */
    todayEvents(): AcademicEventWithCourse[] {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      return this.allEvents.filter(e => {
        const startDate = new Date(e.tanggal_mulai).toISOString().split('T')[0]
        const endDate = new Date(e.tanggal_selesai).toISOString().split('T')[0]
        return startDate <= todayStr && endDate >= todayStr
      })
    },
  },

  actions: {
    init() {
      if (this.initialized) return
      this.initialized = true
      this.events = DEMO_EVENTS
    },

    /** Add a new event */
    addEvent(event: Omit<AcademicEvent, 'id' | 'created_at' | 'updated_at'>) {
      const now = new Date().toISOString()
      const newEvent: AcademicEvent = {
        ...event,
        id: `ev${Date.now()}`,
        created_at: now,
        updated_at: now,
      }
      this.events.push(newEvent)
      this.demoVersion++
      return newEvent
    },

    /** Update an existing event */
    updateEvent(id: string, data: Partial<AcademicEvent>) {
      const event = this.events.find(e => e.id === id)
      if (event) {
        Object.assign(event, data, { updated_at: new Date().toISOString() })
        this.demoVersion++
      }
    },

    /** Delete an event */
    deleteEvent(id: string) {
      this.events = this.events.filter(e => e.id !== id)
      this.demoVersion++
    },

    /** Format date for display */
    formatDate(dateStr: string): string {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    },

    /** Format time for display */
    formatTime(dateStr: string): string {
      return new Date(dateStr).toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit',
      })
    },
  },
})
