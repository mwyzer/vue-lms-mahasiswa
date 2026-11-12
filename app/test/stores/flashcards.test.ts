/**
 * Flashcards Store — Unit Tests (demo mode + a Supabase-mode smoke test).
 * CRUD, SM-2 review scheduling, due queue, AI drafts (mocked $fetch) and stats.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useFlashcardsStore, computeFlashcardStats, FLASHCARD_FRONT_MAX } from '~/stores/flashcards'
import { useAuthStore } from '~/stores/auth'
import { useUiStore } from '~/stores/ui'
import { addDaysToDateKey, toLocalDateKey } from '~/utils/sm2'
import type { Flashcard, FlashcardReview } from '~/types/flashcard'

const today = () => toLocalDateKey()

async function loginStudent(nama = 'Ahmad Fauzi', npm = '20241001') {
  expect(await useAuthStore().loginAsStudent(nama, npm, 'mahasiswa123')).toBe(true)
}

describe('flashcards store (demo mode)', () => {
  beforeEach(async () => {
    await useAuthStore().init()
    await loginStudent()
    await useFlashcardsStore().init()
  })

  it('loads demo cards of the logged-in student only', () => {
    const store = useFlashcardsStore()
    expect(store.isDemoMode).toBe(true)
    expect(store.myCards.length).toBeGreaterThan(0)
    expect(store.myCards.every((c) => c.user_id === 's1' && c.status === 'active')).toBe(true)
  })

  it('due queue contains cards due today or overdue, overdue first', () => {
    const due = useFlashcardsStore().dueCards(today())
    expect(due.length).toBeGreaterThan(0)
    expect(due.every((c) => c.due_date <= today())).toBe(true)
    expect(due[0]!.due_date < today()).toBe(true)
    // a card due in the future is not in the queue
    expect(due.some((c) => c.id === 'fc5')).toBe(false)
  })

  it('creates, edits and deletes a manual card', async () => {
    const store = useFlashcardsStore()
    const id = await store.createCard({ front: '  Apa itu bool? ', back: 'True/False', course_id: 'c1' })
    expect(id).toBeTruthy()
    const card = store.myCards.find((c) => c.id === id)!
    expect(card).toMatchObject({ front: 'Apa itu bool?', source: 'manual', repetitions: 0, ease_factor: 2.5, due_date: today(), review_count: 0 })
    expect(store.dueCards(today()).some((c) => c.id === id)).toBe(true)

    expect(await store.updateCard(id!, { back: 'Tipe logika: True atau False' })).toBe(true)
    expect(store.myCards.find((c) => c.id === id)!.back).toBe('Tipe logika: True atau False')

    expect(await store.deleteCard(id!)).toBe(true)
    expect(store.myCards.some((c) => c.id === id)).toBe(false)
  })

  it('validates input', async () => {
    const store = useFlashcardsStore()
    expect(await store.createCard({ front: ' ', back: 'x' })).toBeNull()
    expect(store.error).toMatch(/harus diisi/)
    expect(await store.createCard({ front: 'x'.repeat(FLASHCARD_FRONT_MAX + 1), back: 'x' })).toBeNull()
    expect(store.error).toMatch(/maksimal/)
  })

  it('review applies SM-2, removes the card from today’s queue and logs the review', async () => {
    const store = useFlashcardsStore()
    const id = (await store.createCard({ front: 'Q baru', back: 'A' }))!
    const before = store.myReviews.length
    const now = new Date()

    const after = await store.reviewCard(id, 4, now)
    expect(after).toMatchObject({ repetitions: 1, interval_days: 1, due_date: addDaysToDateKey(today(), 1), review_count: 1 })
    expect(store.dueCards(today()).some((c) => c.id === id)).toBe(false)
    expect(store.myReviews.length).toBe(before + 1)
    expect(store.myReviews.at(-1)).toMatchObject({ card_id: id, quality: 4, interval_days: 1 })

    // "Lagi" on a learned card resets it
    const lapse = await store.reviewCard(id, 1, now)
    expect(lapse).toMatchObject({ repetitions: 0, interval_days: 1, lapses: 1 })
  })

  it('rejects invalid qualities and unknown cards', async () => {
    const store = useFlashcardsStore()
    expect(await store.reviewCard('fc1', 7)).toBeNull()
    expect(await store.reviewCard('nope', 3)).toBeNull()
  })

  it('cannot touch cards of another user', async () => {
    const store = useFlashcardsStore()
    expect(await store.reviewCard('fc7', 5)).toBeNull() // fc7 belongs to s2
    expect(await store.deleteCard('fc7')).toBe(false)
  })

  it('AI drafts stay drafts until saved; only selected, non-duplicate drafts are saved', async () => {
    const store = useFlashcardsStore()
    const fetchMock = vi.fn(async () => ({
      source: 'demo',
      cards: [
        { front: 'Apa itu variabel?', back: 'Nama yang menunjuk ke nilai.' },
        { front: 'Apa tipe data Python untuk bilangan desimal?', back: 'float' }, // duplicate of demo card fc1
        { front: 'Apa fungsi type()?', back: 'Mengetahui tipe data.' },
      ],
    }))
    ;(globalThis as any).$fetch = fetchMock
    const total = store.myCards.length

    const res = await store.generateDrafts({ id: 'l2', course_id: 'c1', judul: 'Variabel', konten: 'isi' }, { count: 3 })
    expect(res).toEqual({ count: 3, source: 'demo' })
    expect(fetchMock).toHaveBeenCalledWith('/api/ai/generate-flashcards', expect.objectContaining({ method: 'POST' }))
    const body = (fetchMock.mock.calls[0] as any)[1].body
    expect(body.existing).toContain('Apa tipe data Python untuk bilangan desimal?')
    expect(store.drafts.every((d) => d.status === 'draft')).toBe(true)
    expect(store.myCards.length).toBe(total) // nothing saved yet

    store.updateDraft(store.drafts[2]!.uid, { selected: false })
    store.updateDraft(store.drafts[0]!.uid, { back: 'Nama untuk sebuah nilai di memori.' })
    const saved = await store.saveDrafts()
    expect(saved).toBe(1) // draft 2 is a duplicate, draft 3 unselected
    expect(store.myCards.length).toBe(total + 1)
    const card = store.myCards.find((c) => c.front === 'Apa itu variabel?')!
    expect(card).toMatchObject({ back: 'Nama untuk sebuah nilai di memori.', lesson_id: 'l2', course_id: 'c1', status: 'active' })
    expect(store.drafts.map((d) => d.front)).toEqual(['Apa fungsi type()?'])
  })

  it('reports AI errors without creating drafts', async () => {
    const store = useFlashcardsStore()
    ;(globalThis as any).$fetch = vi.fn(async () => { throw Object.assign(new Error('x'), { data: { message: 'Isi materi terlalu pendek' } }) })
    const res = await store.generateDrafts({ id: 'l1', course_id: 'c1', judul: 'x', konten: 'x' })
    expect(res.count).toBe(0)
    expect(store.error).toContain('Isi materi terlalu pendek')
    expect(store.drafts).toEqual([])
  })

  it('stats reflect the queue and today’s reviews', async () => {
    const store = useFlashcardsStore()
    const s0 = store.stats(today())
    expect(s0.total).toBe(store.myCards.length)
    expect(s0.due).toBe(store.dueCards(today()).length)
    expect(s0.forecast).toHaveLength(7)
    expect(s0.forecast[0]!.count).toBe(s0.due)
    await store.reviewCard(store.dueCards(today())[0]!.id, 5)
    await store.reviewCard(store.dueCards(today())[0]!.id, 0)
    const s1 = store.stats(today())
    expect(s1.reviewedToday).toBe(2)
    expect(s1.accuracyToday).toBe(50)
    expect(s1.streak).toBeGreaterThanOrEqual(1)
  })
})

describe('computeFlashcardStats', () => {
  const T = '2026-03-10'
  const mk = (over: Partial<Flashcard>): Flashcard => ({
    id: 'x', user_id: 'u', course_id: null, lesson_id: null, front: 'f', back: 'b', status: 'active', source: 'manual',
    ease_factor: 2.5, interval_days: 0, repetitions: 0, due_date: T, lapses: 0, review_count: 0, last_reviewed_at: null,
    created_at: '', updated_at: '', ...over,
  })
  const rv = (date: string, quality: 0 | 1 | 2 | 3 | 4 | 5): FlashcardReview => ({
    id: date + quality, card_id: 'x', user_id: 'u', quality, interval_days: 1, ease_factor: 2.5, reviewed_at: new Date(`${date}T10:00:00`).toISOString(),
  })

  it('classifies new/learning/mature, computes streak and forecast', () => {
    const cards = [
      mk({ id: 'a' }),
      mk({ id: 'b', review_count: 2, interval_days: 6, due_date: '2026-03-12', ease_factor: 2.3, lapses: 1 }),
      mk({ id: 'c', review_count: 5, interval_days: 30, due_date: '2026-04-09', ease_factor: 2.7 }),
      mk({ id: 'd', review_count: 1, interval_days: 1, due_date: '2026-03-08' }),
      mk({ id: 'e', status: 'draft' }),
    ]
    const s = computeFlashcardStats(cards, [rv('2026-03-08', 4), rv('2026-03-09', 3), rv('2026-03-10', 1), rv('2026-03-10', 5)], T)
    expect(s).toMatchObject({ total: 4, due: 2, fresh: 1, learning: 2, mature: 1, reviewedToday: 2, correctToday: 1, accuracyToday: 50, totalLapses: 1, streak: 3 })
    expect(s.averageEase).toBe(2.5)
    expect(s.forecast.map((f) => f.count)).toEqual([2, 0, 1, 0, 0, 0, 0])
  })

  it('streak counts up to yesterday when nothing was reviewed today', () => {
    const s = computeFlashcardStats([], [rv('2026-03-08', 4), rv('2026-03-09', 4)], T)
    expect(s.streak).toBe(2)
    expect(s.accuracyToday).toBeNull()
    expect(s.averageEase).toBeNull()
  })
})

describe('flashcards store (Supabase mode)', () => {
  it('loads cards from Supabase and inserts through the client', async () => {
    const rows: Flashcard[] = [{
      id: 'uuid-1', user_id: 's1', course_id: null, lesson_id: null, front: 'F', back: 'B', status: 'active', source: 'manual',
      ease_factor: '2.50' as unknown as number, interval_days: 0, repetitions: 0, due_date: '2000-01-01', lapses: 0,
      review_count: 0, last_reviewed_at: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    }]
    const calls: string[] = []
    const chain = (table: string) => {
      const result = { data: table === 'flashcards' ? rows : [], error: null }
      const q: any = {
        select: () => q, eq: () => q, gte: () => q,
        order: () => Promise.resolve(result),
        insert: (payload: any) => {
          calls.push(`insert:${table}`)
          return { select: () => Promise.resolve({ data: [{ ...payload[0], id: 'uuid-2', created_at: 'now', updated_at: 'now' }], error: null }) }
        },
      }
      return q
    }
    const originalNuxtApp = (globalThis as any).useNuxtApp
    ;(globalThis as any).useNuxtApp = vi.fn(() => ({ $supabase: { from: (t: string) => { calls.push(`from:${t}`); return chain(t) } } }))
    try {
      await useAuthStore().init()
      await loginStudent()
      useUiStore().demoModeOverride = false
      const store = useFlashcardsStore()
      await store.init()
      expect(store.isDemoMode).toBe(false)
      expect(store.myCards).toHaveLength(1)
      expect(store.myCards[0]!.ease_factor).toBe(2.5)
      expect(store.dueCards().map((c) => c.id)).toEqual(['uuid-1'])
      const id = await store.createCard({ front: 'Baru', back: 'Isi' })
      expect(id).toBe('uuid-2')
      expect(calls).toContain('insert:flashcards')
    } finally {
      useUiStore().demoModeOverride = null
      ;(globalThis as any).useNuxtApp = originalNuxtApp
    }
  })
})
