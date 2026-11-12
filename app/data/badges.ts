/**
 * Badge definitions (Prioritas 3 — progres & gamifikasi).
 *
 * Pure data: each badge is earned when `stats[metric] >= min`
 * (see `evaluateBadges` in app/lib/progress.ts). Add or tune badges here
 * without touching store/UI code. `id` is stored in `user_badges.badge_id`,
 * so never rename an existing id.
 */
import type { ActivityStats } from '~/lib/progress'

export type BadgeTier = 'perunggu' | 'perak' | 'emas'

export interface BadgeDefinition {
  id: string
  nama: string
  deskripsi: string
  icon: string
  tier: BadgeTier
  metric: keyof ActivityStats
  min: number
}

export const BADGES: readonly BadgeDefinition[] = [
  { id: 'pemula', nama: 'Pemula', deskripsi: 'Mencatat aktivitas belajar pertama.', icon: '🌱', tier: 'perunggu', metric: 'totalActivities', min: 1 },
  { id: 'streak-3', nama: 'Konsisten', deskripsi: 'Belajar 3 hari berturut-turut.', icon: '🔥', tier: 'perunggu', metric: 'longestStreak', min: 3 },
  { id: 'streak-7', nama: 'Streak 7 Hari', deskripsi: 'Belajar 7 hari berturut-turut.', icon: '⚡', tier: 'perak', metric: 'longestStreak', min: 7 },
  { id: 'streak-30', nama: 'Streak 30 Hari', deskripsi: 'Belajar 30 hari berturut-turut.', icon: '🏔️', tier: 'emas', metric: 'longestStreak', min: 30 },
  { id: 'kutu-buku', nama: 'Kutu Buku', deskripsi: 'Menyelesaikan 10 materi.', icon: '📚', tier: 'perak', metric: 'lessonsCompleted', min: 10 },
  { id: 'nilai-sempurna', nama: 'Nilai Sempurna', deskripsi: 'Mendapat nilai 100 pada sebuah kuis.', icon: '💯', tier: 'emas', metric: 'perfectQuizzes', min: 1 },
  { id: 'pejuang-kuis', nama: 'Pejuang Kuis', deskripsi: 'Mengerjakan 5 kuis.', icon: '✍️', tier: 'perak', metric: 'quizzesSubmitted', min: 5 },
  { id: 'tepat-waktu', nama: 'Rajin Tugas', deskripsi: 'Mengumpulkan 3 tugas.', icon: '📝', tier: 'perunggu', metric: 'assignmentsSubmitted', min: 3 },
  { id: 'rajin-forum', nama: 'Rajin Forum', deskripsi: 'Menulis 5 thread atau balasan di forum.', icon: '💬', tier: 'perak', metric: 'forumPosts', min: 5 },
  { id: 'pengulang', nama: 'Ahli Flashcard', deskripsi: 'Mereview 50 flashcard.', icon: '🗂️', tier: 'perak', metric: 'flashcardReviews', min: 50 },
  { id: 'tuntas', nama: 'Tuntas', deskripsi: 'Menyelesaikan seluruh materi sebuah mata kuliah.', icon: '🎓', tier: 'emas', metric: 'coursesCompleted', min: 1 },
]

export const BADGE_TIER_LABEL: Record<BadgeTier, string> = {
  perunggu: 'Perunggu',
  perak: 'Perak',
  emas: 'Emas',
}

export function badgeById(id: string): BadgeDefinition | undefined {
  return BADGES.find((b) => b.id === id)
}
