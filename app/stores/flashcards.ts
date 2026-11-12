/**
 * Flashcards Store — personal study cards with SM-2 spaced repetition.
 *
 * Features:
 * - Manual cards (front/back, optionally linked to a course/lesson)
 * - "Buat dengan AI": POST /api/ai/generate-flashcards → DRAFTS kept in the
 *   store (status 'draft', not persisted) until the user saves them
 * - Review queue: active cards due today or earlier (SM-2, app/utils/sm2.ts)
 * - Statistics from the review log
 * - Demo mode (in-memory) + Supabase mode (tables flashcards, flashcard_reviews;
 *   supabase/migration-prioritas-3-w1.sql)
 */
import { defineStore } from 'pinia'
import type {
  Flashcard,
  FlashcardDraft,
  FlashcardInput,
  FlashcardReview,
  FlashcardStats,
} from '~/types/flashcard'
import {
  SM2_MATURE_DAYS,
  addDaysToDateKey,
  initialSm2State,
  isDue,
  isSm2Quality,
  reviewSm2,
  toLocalDateKey,
  type Sm2Quality,
} from '~/utils/sm2'
import { useAuthStore } from './auth'

export const FLASHCARD_FRONT_MAX = 300
export const FLASHCARD_BACK_MAX = 800
/** Review log window loaded in Supabase mode (statistics only need recent history). */
const REVIEW_HISTORY_DAYS = 60

let demoSeq = 0
const nextDemoId = (prefix: string) => `${prefix}-demo-${Date.now()}-${++demoSeq}`

/** Demo cards for the demo students, with due dates relative to `today`. */
function buildDemoCards(today: string): Flashcard[] {
  const created = '2025-09-01T08:00:00Z'
  const card = (
    id: string,
    user_id: string,
    course_id: string,
    lesson_id: string | null,
    front: string,
    back: string,
    s: { ef?: number; interval?: number; reps?: number; dueIn?: number; lapses?: number; reviews?: number },
  ): Flashcard => ({
    id,
    user_id,
    course_id,
    lesson_id,
    front,
    back,
    status: 'active',
    source: 'demo',
    ease_factor: s.ef ?? 2.5,
    interval_days: s.interval ?? 0,
    repetitions: s.reps ?? 0,
    due_date: addDaysToDateKey(today, s.dueIn ?? 0),
    lapses: s.lapses ?? 0,
    review_count: s.reviews ?? 0,
    last_reviewed_at: s.reviews ? `${addDaysToDateKey(today, (s.dueIn ?? 0) - (s.interval ?? 0))}T08:00:00Z` : null,
    created_at: created,
    updated_at: created,
  })
  return [
    card('fc1', 's1', 'c1', 'l2', 'Apa tipe data Python untuk bilangan desimal?', 'float — contohnya type(3.14) menghasilkan float.', { reps: 2, interval: 6, dueIn: 0, reviews: 2 }),
    card('fc2', 's1', 'c1', 'l4', 'Apa perbedaan perulangan for dan while?', 'for: jumlah pengulangan diketahui / menelusuri koleksi. while: mengulang selama kondisi bernilai True.', { reps: 0, interval: 1, dueIn: -1, lapses: 1, reviews: 3, ef: 2.18 }),
    card('fc3', 's1', 'c1', 'l4', 'Bagaimana membuat pola do-while di Python?', 'Dengan while True yang dihentikan memakai break.', { dueIn: 0 }),
    card('fc4', 's1', 'c1', 'l3', 'Apa beda = dan == di Python?', '= adalah penugasan (assignment), == adalah perbandingan kesamaan.', { reps: 3, interval: 15, dueIn: 4, reviews: 3, ef: 2.6 }),
    card('fc5', 's1', 'c2', 'l5', 'Apa yang dimaksud kardinalitas himpunan?', 'Banyaknya anggota sebuah himpunan, ditulis |A|.', { reps: 4, interval: 32, dueIn: 20, reviews: 4, ef: 2.7 }),
    card('fc6', 's1', 'c2', 'l6', 'Kapan sebuah fungsi disebut bijektif?', 'Jika fungsi itu injektif (satu-satu) sekaligus surjektif (pada).', { dueIn: 0 }),
    card('fc7', 's2', 'c1', 'l2', 'Fungsi apa untuk mengetahui tipe data sebuah nilai?', 'type(), misalnya type("a") menghasilkan str.', { dueIn: 0 }),
  ]
}

function buildDemoReviews(today: string): FlashcardReview[] {
  const at = (daysAgo: number, h: number) => `${addDaysToDateKey(today, -daysAgo)}T${String(h).padStart(2, '0')}:00:00`
  return [
    { id: 'fr-d1', card_id: 'fc2', user_id: 's1', quality: 1, interval_days: 1, ease_factor: 2.18, reviewed_at: new Date(at(1, 9)).toISOString() },
    { id: 'fr-d2', card_id: 'fc4', user_id: 's1', quality: 4, interval_days: 15, ease_factor: 2.6, reviewed_at: new Date(at(1, 9)).toISOString() },
    { id: 'fr-d3', card_id: 'fc1', user_id: 's1', quality: 5, interval_days: 6, ease_factor: 2.5, reviewed_at: new Date(at(2, 20)).toISOString() },
  ]
}

interface FlashcardsState {
  cards: Flashcard[]
  reviews: FlashcardReview[]
  drafts: FlashcardDraft[]
  loading: boolean
  generating: boolean
  error: string | null
  isDemoMode: boolean
  initialized: boolean
  /** User the data was loaded for (re-init after switching accounts). */
  loadedFor: string | null
}

/** Validate front/back; returns an Indonesian error message or null. */
export function validateFlashcardInput(front: string, back: string): string | null {
  const f = String(front ?? '').trim()
  const b = String(back ?? '').trim()
  if (!f || !b) return 'Sisi depan dan belakang kartu harus diisi.'
  if (f.length > FLASHCARD_FRONT_MAX) return `Sisi depan maksimal ${FLASHCARD_FRONT_MAX} karakter.`
  if (b.length > FLASHCARD_BACK_MAX) return `Sisi belakang maksimal ${FLASHCARD_BACK_MAX} karakter.`
  return null
}

const frontKey = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()

/** Statistics over `cards` (active cards of one user) and their review log. Pure; exported for tests. */
export function computeFlashcardStats(cards: readonly Flashcard[], reviews: readonly FlashcardReview[], today: string): FlashcardStats {
  const active = cards.filter((c) => c.status === 'active')
  const todays = reviews.filter((r) => toLocalDateKey(new Date(r.reviewed_at)) === today)
  const correct = todays.filter((r) => r.quality >= 3).length
  const reviewDays = new Set(reviews.map((r) => toLocalDateKey(new Date(r.reviewed_at))))
  let streak = 0
  let day = reviewDays.has(today) ? today : addDaysToDateKey(today, -1)
  while (reviewDays.has(day)) {
    streak++
    day = addDaysToDateKey(day, -1)
  }
  const forecast = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToDateKey(today, i)
    const count = active.filter((c) => (i === 0 ? c.due_date <= date : c.due_date === date)).length
    return { date, count }
  })
  const reviewed = active.filter((c) => c.review_count > 0)
  return {
    total: active.length,
    due: active.filter((c) => isDue(c, today)).length,
    fresh: active.filter((c) => c.review_count === 0).length,
    learning: reviewed.filter((c) => c.interval_days < SM2_MATURE_DAYS).length,
    mature: reviewed.filter((c) => c.interval_days >= SM2_MATURE_DAYS).length,
    reviewedToday: todays.length,
    correctToday: correct,
    accuracyToday: todays.length > 0 ? Math.round((correct / todays.length) * 100) : null,
    averageEase: active.length > 0 ? Math.round((active.reduce((s, c) => s + c.ease_factor, 0) / active.length) * 100) / 100 : null,
    totalLapses: active.reduce((s, c) => s + (c.lapses || 0), 0),
    streak,
    forecast,
  }
}

export const useFlashcardsStore = defineStore('flashcards', {
  state: (): FlashcardsState => ({
    cards: [],
    reviews: [],
    drafts: [],
    loading: false,
    generating: false,
    error: null,
    isDemoMode: true,
    initialized: false,
    loadedFor: null,
  }),

  getters: {
    /** Active cards of the logged-in user, newest first. */
    myCards(): Flashcard[] {
      const uid = useAuthStore().user?.id
      if (!uid) return []
      return this.cards
        .filter((c) => c.user_id === uid && c.status === 'active')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    },

    myReviews(): FlashcardReview[] {
      const uid = useAuthStore().user?.id
      return uid ? this.reviews.filter((r) => r.user_id === uid) : []
    },

    /** Review queue for `today` (default: local today): overdue first, then reviewed-before, then new cards. */
    dueCards(): (today?: string) => Flashcard[] {
      return (today = toLocalDateKey()) =>
        this.myCards
          .filter((c) => isDue(c, today))
          .sort(
            (a, b) =>
              (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0) ||
              Number(a.review_count === 0) - Number(b.review_count === 0) ||
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          )
    },

    stats(): (today?: string) => FlashcardStats {
      return (today = toLocalDateKey()) => computeFlashcardStats(this.myCards, this.myReviews, today)
    },

    cardsByCourse(): (courseId: string | null) => Flashcard[] {
      return (courseId) => (courseId ? this.myCards.filter((c) => c.course_id === courseId) : this.myCards)
    },

    selectedDraftCount(): number {
      return this.drafts.filter((d) => d.selected).length
    },
  },

  actions: {
    async init() {
      const currentUser = useAuthStore().user?.id ?? null
      if (this.initialized && this.loadedFor === currentUser) return
      const ui = useUiStore()
      this.isDemoMode = ui.isDemoMode
      this.error = null

      if (!this.isDemoMode) {
        const uid = useAuthStore().user?.id
        this.loading = true
        try {
          const supabase = useNuxtApp().$supabase
          let cardsQuery = supabase.from('flashcards').select('*')
          if (uid) cardsQuery = cardsQuery.eq('user_id', uid)
          const { data: cards, error: cErr } = await cardsQuery.order('created_at')
          if (cErr) throw cErr

          const since = new Date(Date.now() - REVIEW_HISTORY_DAYS * 86_400_000).toISOString()
          let revQuery = supabase.from('flashcard_reviews').select('*')
          if (uid) revQuery = revQuery.eq('user_id', uid)
          const { data: reviews, error: rErr } = await revQuery.gte('reviewed_at', since).order('reviewed_at')
          if (rErr) throw rErr

          this.cards = ((cards || []) as Flashcard[]).map((c) => ({ ...c, ease_factor: Number(c.ease_factor) }))
          this.reviews = ((reviews || []) as FlashcardReview[]).map((r) => ({ ...r, ease_factor: Number(r.ease_factor) }))
        } catch (err: any) {
          console.error('Failed to fetch flashcards from Supabase, falling back to demo:', err)
          this.isDemoMode = true
        } finally {
          this.loading = false
        }
      }

      if (this.isDemoMode && !(this.initialized && this.cards.length > 0)) this._syncDemo()
      this.drafts = []
      this.loadedFor = currentUser
      this.initialized = true
    },

    _syncDemo(today: string = toLocalDateKey()) {
      this.cards = buildDemoCards(today)
      this.reviews = buildDemoReviews(today)
    },

    /** Create one card. Returns the new ID, or null on failure (see `error`). */
    async createCard(input: FlashcardInput): Promise<string | null> {
      const ids = await this._insertCards([input])
      return ids?.[0] ?? null
    },

    /** Insert several cards at once (manual or saved drafts). Returns new IDs, or null on failure. */
    async _insertCards(inputs: FlashcardInput[]): Promise<string[] | null> {
      const auth = useAuthStore()
      this.error = null
      if (!auth.user) {
        this.error = 'Silakan login terlebih dahulu.'
        return null
      }
      for (const i of inputs) {
        const msg = validateFlashcardInput(i.front, i.back)
        if (msg) {
          this.error = msg
          return null
        }
      }
      const now = new Date().toISOString()
      const today = toLocalDateKey()
      const rows = inputs.map((i) => ({
        user_id: auth.user!.id,
        course_id: i.course_id || null,
        lesson_id: i.lesson_id || null,
        front: i.front.trim(),
        back: i.back.trim(),
        status: 'active' as const,
        source: i.source ?? 'manual',
        ...initialSm2State(today),
        review_count: 0,
        last_reviewed_at: null,
      }))

      if (this.isDemoMode) {
        const cards: Flashcard[] = rows.map((r) => ({ ...r, id: nextDemoId('fc'), created_at: now, updated_at: now }))
        this.cards.push(...cards)
        return cards.map((c) => c.id)
      }

      try {
        const supabase = useNuxtApp().$supabase
        const { data, error } = await supabase.from('flashcards').insert(rows).select()
        if (error) throw error
        const saved = ((data || []) as Flashcard[]).map((c) => ({ ...c, ease_factor: Number(c.ease_factor) }))
        this.cards.push(...saved)
        return saved.map((c) => c.id)
      } catch (err: any) {
        console.error('Failed to create flashcards:', err)
        this.error = 'Gagal menyimpan kartu. Coba lagi.'
        return null
      }
    },

    /** Edit front/back/course of an own card. Scheduling is kept. */
    async updateCard(id: string, patch: { front?: string; back?: string; course_id?: string | null; lesson_id?: string | null }): Promise<boolean> {
      this.error = null
      const card = this.myCards.find((c) => c.id === id)
      if (!card) {
        this.error = 'Kartu tidak ditemukan.'
        return false
      }
      const front = patch.front ?? card.front
      const back = patch.back ?? card.back
      const msg = validateFlashcardInput(front, back)
      if (msg) {
        this.error = msg
        return false
      }
      const payload = {
        front: front.trim(),
        back: back.trim(),
        course_id: patch.course_id === undefined ? card.course_id : patch.course_id,
        lesson_id: patch.lesson_id === undefined ? card.lesson_id : patch.lesson_id,
        updated_at: new Date().toISOString(),
      }
      if (!this.isDemoMode) {
        try {
          const { error } = await useNuxtApp().$supabase.from('flashcards').update(payload).eq('id', id)
          if (error) throw error
        } catch (err) {
          console.error('Failed to update flashcard:', err)
          this.error = 'Gagal memperbarui kartu.'
          return false
        }
      }
      Object.assign(card, payload)
      return true
    },

    async deleteCard(id: string): Promise<boolean> {
      this.error = null
      const card = this.myCards.find((c) => c.id === id)
      if (!card) return false
      if (!this.isDemoMode) {
        try {
          const { error } = await useNuxtApp().$supabase.from('flashcards').delete().eq('id', id)
          if (error) throw error
        } catch (err) {
          console.error('Failed to delete flashcard:', err)
          this.error = 'Gagal menghapus kartu.'
          return false
        }
      }
      this.cards = this.cards.filter((c) => c.id !== id)
      this.reviews = this.reviews.filter((r) => r.card_id !== id)
      return true
    },

    /**
     * Grade a card with SM-2 quality 0–5 and reschedule it. `now` is injectable for tests.
     * Returns the updated card, or null (unknown card / invalid quality / save failure).
     */
    async reviewCard(id: string, quality: number, now: Date = new Date()): Promise<Flashcard | null> {
      this.error = null
      if (!isSm2Quality(quality)) {
        this.error = 'Nilai kualitas harus 0–5.'
        return null
      }
      const card = this.myCards.find((c) => c.id === id)
      if (!card) {
        this.error = 'Kartu tidak ditemukan.'
        return null
      }
      const today = toLocalDateKey(now)
      const next = reviewSm2(card, quality, today)
      const ts = now.toISOString()
      const patch = { ...next, review_count: card.review_count + 1, last_reviewed_at: ts, updated_at: ts }
      const review: FlashcardReview = {
        id: nextDemoId('fr'),
        card_id: card.id,
        user_id: card.user_id,
        quality: quality as Sm2Quality,
        interval_days: next.interval_days,
        ease_factor: next.ease_factor,
        reviewed_at: ts,
      }

      if (!this.isDemoMode) {
        try {
          const supabase = useNuxtApp().$supabase
          const { error } = await supabase.from('flashcards').update(patch).eq('id', id)
          if (error) throw error
          const { id: _ignored, ...row } = review
          const { data, error: rErr } = await supabase.from('flashcard_reviews').insert(row).select().single()
          if (rErr) console.warn('Failed to log flashcard review (card was rescheduled):', rErr)
          else if (data?.id) review.id = data.id
        } catch (err) {
          console.error('Failed to save flashcard review:', err)
          this.error = 'Gagal menyimpan hasil review.'
          return null
        }
      }
      Object.assign(card, patch)
      this.reviews.push(review)
      return card
    },

    // ── AI drafts ──────────────────────────────────────

    /**
     * Ask the server for draft cards from a lesson. Drafts replace the current ones
     * and are NOT saved. Returns the number of drafts, or 0 on failure (see `error`).
     */
    async generateDrafts(
      lesson: { id: string; course_id: string; judul: string; konten?: string | null },
      opts: { count?: number; fresh?: boolean } = {},
    ): Promise<{ count: number; source: 'ai' | 'demo' | null }> {
      this.error = null
      this.generating = true
      try {
        const existing = this.myCards.map((c) => c.front).slice(0, 500)
        const res = await $fetch<{ cards: { front: string; back: string }[]; source: 'ai' | 'demo' }>('/api/ai/generate-flashcards', {
          method: 'POST',
          body: {
            lesson: { judul: lesson.judul, konten: lesson.konten ?? '' },
            count: opts.count ?? 8,
            existing,
            ...(opts.fresh ? { seed: Math.floor(Math.random() * 2 ** 31) } : {}),
          },
        })
        const cards = Array.isArray(res?.cards) ? res.cards : []
        this.drafts = cards.map((c, i) => ({
          uid: `draft-${Date.now()}-${i}`,
          front: String(c.front ?? ''),
          back: String(c.back ?? ''),
          course_id: lesson.course_id,
          lesson_id: lesson.id,
          source: res.source === 'ai' ? 'ai' : 'demo',
          status: 'draft',
          selected: true,
        }))
        if (this.drafts.length === 0) this.error = 'AI tidak menghasilkan kartu dari materi ini.'
        return { count: this.drafts.length, source: res?.source ?? null }
      } catch (err: any) {
        const msg = err?.data?.message || err?.data?.statusMessage || err?.statusMessage || err?.message
        this.error = msg ? `Gagal membuat kartu: ${msg}` : 'Gagal membuat kartu dengan AI.'
        return { count: 0, source: null }
      } finally {
        this.generating = false
      }
    },

    updateDraft(uid: string, patch: Partial<Pick<FlashcardDraft, 'front' | 'back' | 'selected'>>) {
      const d = this.drafts.find((x) => x.uid === uid)
      if (d) Object.assign(d, patch)
    },

    removeDraft(uid: string) {
      this.drafts = this.drafts.filter((d) => d.uid !== uid)
    },

    clearDrafts() {
      this.drafts = []
    },

    /**
     * Save the SELECTED drafts as active cards (skipping fronts the user already has).
     * Saved drafts are removed from the list. Returns the number saved, or -1 on failure.
     */
    async saveDrafts(): Promise<number> {
      this.error = null
      const selected = this.drafts.filter((d) => d.selected)
      if (selected.length === 0) return 0
      for (const d of selected) {
        const msg = validateFlashcardInput(d.front, d.back)
        if (msg) {
          this.error = `Draf "${d.front.slice(0, 40) || '(kosong)'}": ${msg}`
          return -1
        }
      }
      const have = new Set(this.myCards.map((c) => frontKey(c.front)))
      const toSave = selected.filter((d) => {
        const k = frontKey(d.front)
        if (have.has(k)) return false
        have.add(k)
        return true
      })
      if (toSave.length > 0) {
        const ids = await this._insertCards(
          toSave.map((d) => ({ front: d.front, back: d.back, course_id: d.course_id, lesson_id: d.lesson_id, source: d.source })),
        )
        if (!ids) return -1
      }
      const savedUids = new Set(selected.map((d) => d.uid))
      this.drafts = this.drafts.filter((d) => !savedUids.has(d.uid))
      return toSave.length
    },
  },
})
