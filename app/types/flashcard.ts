/**
 * Flashcard types (Prioritas 3 — W1). Mirrors supabase/migration-prioritas-3-w1.sql.
 */
import type { Sm2Quality, Sm2State } from '~/utils/sm2'

export type FlashcardSource = 'manual' | 'ai' | 'demo'

/** A saved card (table `flashcards`). SM-2 fields come from {@link Sm2State}. */
export interface Flashcard extends Sm2State {
  id: string
  user_id: string
  course_id: string | null
  lesson_id: string | null
  front: string
  back: string
  /** Saved cards are 'active'. 'draft' exists for forward compatibility; AI drafts live in the store until saved. */
  status: 'active' | 'draft'
  source: FlashcardSource
  review_count: number
  last_reviewed_at: string | null
  created_at: string
  updated_at: string
}

/** One review (table `flashcard_reviews`), used for statistics. */
export interface FlashcardReview {
  id: string
  card_id: string
  user_id: string
  quality: Sm2Quality
  interval_days: number
  ease_factor: number
  reviewed_at: string
}

/** AI-generated card waiting for the user's decision (never persisted as-is). */
export interface FlashcardDraft {
  uid: string
  front: string
  back: string
  course_id: string | null
  lesson_id: string | null
  source: 'ai' | 'demo'
  status: 'draft'
  selected: boolean
}

export interface FlashcardInput {
  front: string
  back: string
  course_id?: string | null
  lesson_id?: string | null
  source?: FlashcardSource
}

export interface FlashcardStats {
  total: number
  due: number
  /** Never reviewed. */
  fresh: number
  /** Reviewed, interval < 21 days. */
  learning: number
  /** Interval ≥ 21 days. */
  mature: number
  reviewedToday: number
  correctToday: number
  /** 0–100, or null when nothing was reviewed today. */
  accuracyToday: number | null
  averageEase: number | null
  totalLapses: number
  /** Consecutive days (ending today or yesterday) with at least one review. */
  streak: number
  /** Cards due on each of the next 7 days (index 0 = today, incl. overdue). */
  forecast: Array<{ date: string; count: number }>
}
