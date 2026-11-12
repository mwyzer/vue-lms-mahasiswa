/**
 * Rubrics Store — grading rubrics, rubric-based grading and anonymous peer review.
 *
 * Features:
 * - Instructor creates/edits a rubric per assignment (criteria, weights, levels with points)
 * - Rubric grading: chosen level per criterion → total score → `submissions.nilai`
 *   (saved through assignmentsStore.gradeSubmission, so the gradebook and the
 *   "nilai keluar" notification keep working unchanged)
 * - Peer review: config per assignment, random balanced reviewer assignment,
 *   rubric-based reviews by students, instructor override/exclude, and the peer
 *   average blended into the final assignment score (gradebook) by its weight
 * - Demo mode (in-memory) + Supabase mode (see supabase/migration-prioritas-3-w3.sql)
 *
 * Pure logic lives in shared/rubric.ts and shared/peerReview.ts (unit tested).
 *
 * Anonymity: in Supabase mode a student never receives `reviewer_id` of reviews
 * on their own work, nor `student_id` of the work they review — both come from
 * SECURITY DEFINER RPCs that omit those columns. Demo mode keeps everything in
 * browser memory, so anonymity there is only at the UI level.
 */
import { defineStore } from 'pinia'
import type { Submission } from '~/types/database'
import { useAuthStore } from './auth'
import { useAssignmentsStore, DEMO_ASSIGNMENTS } from './assignments'
import { useNotificationsStore } from './notifications'
import {
  DEFAULT_PEER_CONFIG,
  computeRubricScore,
  newRubricId,
  sanitizeSelection,
  validatePeerConfig,
  validateRubricCriteria,
  type PeerReviewConfig,
  type Rubric,
  type RubricCriterion,
  type RubricSelection,
} from '#shared/rubric'
import {
  aggregatePeerScores,
  anonymousLabels,
  assignReviewers,
  combineScores,
  isReviewOpen,
  type PeerReview,
  type PeerSummary,
} from '#shared/peerReview'

export interface RubricScoreRow {
  id: string
  submission_id: string
  criterion_id: string
  level_id: string
  poin: number
}

/** What a reviewer sees: the work to review, without its author. */
export interface PeerReviewTask extends PeerReview {
  jawaban: string | null
  file_name: string | null
  /** "Jawaban 1…n" — position among this reviewer's tasks for the assignment. */
  label: string
}

/** What the author sees: a review of their work, without the reviewer. */
export interface AnonymousReview {
  id: string
  label: string
  selections: Record<string, string>
  komentar: string
  skor: number | null
  submitted_at: string | null
}

/** Reminder window (hours) before the peer review deadline. */
export const PEER_REMINDER_HOURS = 24

// ── Demo data ────────────────────────────────────────────

const DEMO_RUBRICS: Rubric[] = [
  {
    id: 'rb-a1',
    assignment_id: 'a1',
    criteria: [
      {
        id: 'rc-a1-1', nama: 'Ketepatan output', deskripsi: 'Program mencetak teks yang diminta.', bobot: 50,
        levels: [
          { id: 'rl-a1-1-4', label: 'Sangat baik', deskripsi: 'Output persis "Hello, World!" dan program berjalan tanpa error.', poin: 4 },
          { id: 'rl-a1-1-3', label: 'Baik', deskripsi: 'Output benar dengan perbedaan kecil (tanda baca/kapital).', poin: 3 },
          { id: 'rl-a1-1-2', label: 'Cukup', deskripsi: 'Program berjalan tetapi output tidak sesuai.', poin: 2 },
          { id: 'rl-a1-1-1', label: 'Kurang', deskripsi: 'Program error atau tidak ada output.', poin: 1 },
        ],
      },
      {
        id: 'rc-a1-2', nama: 'Kerapian kode', deskripsi: 'Penamaan, indentasi dan komentar.', bobot: 30,
        levels: [
          { id: 'rl-a1-2-4', label: 'Sangat baik', deskripsi: 'Rapi, konsisten, ada komentar singkat.', poin: 4 },
          { id: 'rl-a1-2-3', label: 'Baik', deskripsi: 'Rapi tanpa komentar.', poin: 3 },
          { id: 'rl-a1-2-2', label: 'Cukup', deskripsi: 'Ada ketidakkonsistenan kecil.', poin: 2 },
          { id: 'rl-a1-2-1', label: 'Kurang', deskripsi: 'Sulit dibaca.', poin: 1 },
        ],
      },
      {
        id: 'rc-a1-3', nama: 'Penjelasan', deskripsi: 'Penjelasan singkat cara kerja program.', bobot: 20,
        levels: [
          { id: 'rl-a1-3-3', label: 'Lengkap', deskripsi: 'Menjelaskan fungsi print dan cara menjalankan program.', poin: 3 },
          { id: 'rl-a1-3-2', label: 'Sebagian', deskripsi: 'Penjelasan ada tetapi kurang jelas.', poin: 2 },
          { id: 'rl-a1-3-0', label: 'Tidak ada', deskripsi: 'Tanpa penjelasan.', poin: 0 },
        ],
      },
    ],
    peer: { ...DEFAULT_PEER_CONFIG },
    created_at: '2025-08-01T08:00:00Z',
    updated_at: '2025-08-01T08:00:00Z',
  },
]

const DEMO_RUBRIC_SCORES: RubricScoreRow[] = []
const DEMO_PEER_REVIEWS: PeerReview[] = []
let demoSeq = 0
const demoId = (p: string) => `${p}-${Date.now().toString(36)}-${(++demoSeq).toString(36)}`

const cloneRubric = (r: Rubric): Rubric => ({
  ...r,
  peer: { ...r.peer },
  criteria: r.criteria.map((c) => ({ ...c, levels: c.levels.map((l) => ({ ...l })) })),
})

// ── Supabase row mapping ─────────────────────────────────

function assembleRubrics(rubrics: any[], criteria: any[], levels: any[]): Rubric[] {
  const byOrder = (a: any, b: any) => (a.urutan ?? 0) - (b.urutan ?? 0)
  return rubrics.map((r) => ({
    id: r.id,
    assignment_id: r.assignment_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    peer: {
      enabled: !!r.peer_enabled,
      reviewers_per_submission: r.peer_reviewers ?? DEFAULT_PEER_CONFIG.reviewers_per_submission,
      deadline: r.peer_deadline ?? null,
      weight: r.peer_weight ?? DEFAULT_PEER_CONFIG.weight,
      assigned_at: r.peer_assigned_at ?? null,
    },
    criteria: criteria
      .filter((c) => c.rubric_id === r.id)
      .sort(byOrder)
      .map((c) => ({
        id: c.id,
        nama: c.nama,
        deskripsi: c.deskripsi ?? '',
        bobot: c.bobot,
        levels: levels
          .filter((l) => l.criterion_id === c.id)
          .sort(byOrder)
          .map((l) => ({ id: l.id, label: l.label, deskripsi: l.deskripsi ?? '', poin: Number(l.poin) })),
      })),
  }))
}

function toPeerReview(row: any): PeerReview {
  return {
    id: row.id,
    assignment_id: row.assignment_id,
    submission_id: row.submission_id,
    reviewer_id: row.reviewer_id ?? '',
    status: row.status === 'submitted' ? 'submitted' : 'assigned',
    selections: row.selections || {},
    komentar: row.komentar || '',
    skor: row.skor == null ? null : Number(row.skor),
    override_skor: row.override_skor == null ? null : Number(row.override_skor),
    override_note: row.override_note ?? null,
    excluded: !!row.excluded,
    submitted_at: row.submitted_at ?? null,
    created_at: row.created_at ?? '',
  }
}

// ── Store ────────────────────────────────────────────────

interface RubricsState {
  rubrics: Rubric[]
  rubricScores: RubricScoreRow[]
  /** Staff: every review. Student: reviews they write. */
  peerReviews: PeerReview[]
  /** Supabase (student): text of the work they review, by review id. */
  peerTexts: Record<string, { jawaban: string | null; file_name: string | null }>
  /** Supabase (student): reviews of their own work, without reviewer identity. */
  receivedReviews: PeerReview[]
  loading: boolean
  error: string | null
  isDemoMode: boolean
  initialized: boolean
}

export const useRubricsStore = defineStore('rubrics', {
  state: (): RubricsState => ({
    rubrics: [],
    rubricScores: [],
    peerReviews: [],
    peerTexts: {},
    receivedReviews: [],
    loading: false,
    error: null,
    isDemoMode: true,
    initialized: false,
  }),

  getters: {
    rubricFor(): (assignmentId: string) => Rubric | null {
      return (assignmentId: string) => this.rubrics.find((r) => r.assignment_id === assignmentId) || null
    },

    /** Instructor rubric selection saved for a submission. */
    selectionFor(): (submissionId: string) => RubricSelection {
      return (submissionId: string) => {
        const out: RubricSelection = {}
        for (const s of this.rubricScores) if (s.submission_id === submissionId) out[s.criterion_id] = s.level_id
        return out
      }
    },

    /** Staff: every review of a submission. */
    reviewsForSubmission(): (submissionId: string) => PeerReview[] {
      return (submissionId: string) => this.peerReviews.filter((r) => r.submission_id === submissionId)
    },

    reviewsForAssignment(): (assignmentId: string) => PeerReview[] {
      return (assignmentId: string) => this.peerReviews.filter((r) => r.assignment_id === assignmentId)
    },

    /** Peer summary of one submission (from whatever reviews this user may see). */
    peerSummaryFor(): (submissionId: string) => PeerSummary | null {
      return (submissionId: string) => {
        const rows = [...this.peerReviews, ...this.receivedReviews].filter((r) => r.submission_id === submissionId)
        if (rows.length === 0) return null
        return aggregatePeerScores(rows)[submissionId] ?? null
      }
    },

    /**
     * Final score of a submission: instructor score blended with the peer
     * average when peer review is enabled for the assignment.
     */
    finalScoreFor(): (sub: Pick<Submission, 'id' | 'assignment_id' | 'nilai'>) => number | null {
      return (sub) => {
        const instructor = typeof sub.nilai === 'number' ? sub.nilai : null
        const rubric = this.rubricFor(sub.assignment_id)
        if (!rubric?.peer.enabled || !rubric.peer.weight) return instructor
        return combineScores(instructor, this.peerSummaryFor(sub.id)?.average ?? null, rubric.peer.weight)
      }
    },

    /** Submissions with `nilai` replaced by the final (peer-blended) score — used by the gradebook. */
    withFinalScores(): <T extends Submission>(subs: T[]) => T[] {
      return <T extends Submission>(subs: T[]) =>
        subs.map((s) => {
          if (typeof s.nilai !== 'number') return s
          const final = this.finalScoreFor(s)
          return final === s.nilai ? s : { ...s, nilai: final }
        })
    },

    /** Signed-in student's review tasks for an assignment. */
    myReviewTasks(): (assignmentId: string) => PeerReviewTask[] {
      return (assignmentId: string) => {
        const auth = useAuthStore()
        const uid = auth.user?.id
        if (!uid) return []
        const assignments = useAssignmentsStore()
        const subs = assignments.isDemoMode ? assignments.submissions : assignments.sbSubmissions
        return this.peerReviews
          .filter((r) => r.assignment_id === assignmentId && r.reviewer_id === uid)
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .map((r, i) => {
            const text = this.isDemoMode
              ? subs.find((s) => s.id === r.submission_id)
              : this.peerTexts[r.id]
            return { ...r, jawaban: text?.jawaban ?? null, file_name: text?.file_name ?? null, label: `Jawaban ${i + 1}` }
          })
      }
    },

    /** Reviews of the signed-in student's own submission — anonymous, counted ones only. */
    myReceivedReviews(): (submissionId: string) => AnonymousReview[] {
      return (submissionId: string) => {
        const source = this.isDemoMode ? this.peerReviews : this.receivedReviews
        const counted = source.filter(
          (r) => r.submission_id === submissionId && !r.excluded && (r.status === 'submitted' || r.override_skor != null),
        )
        return anonymousLabels(counted).map((r) => ({
          id: r.id,
          label: r.label,
          selections: r.selections,
          komentar: r.komentar,
          skor: r.override_skor ?? r.skor,
          submitted_at: r.submitted_at,
        }))
      }
    },
  },

  actions: {
    async init() {
      if (this.initialized) return
      const ui = useUiStore()
      this.isDemoMode = ui.isDemoMode
      this.error = null

      if (!this.isDemoMode) {
        this.loading = true
        try {
          const supabase = useNuxtApp().$supabase
          const [r, c, l, s, p] = await Promise.all([
            supabase.from('rubrics').select('*'),
            supabase.from('rubric_criteria').select('*'),
            supabase.from('rubric_levels').select('*'),
            supabase.from('rubric_scores').select('*'),
            supabase.from('peer_reviews').select('*'),
          ])
          const err = r.error || c.error || l.error || s.error || p.error
          if (err) throw err
          this.rubrics = assembleRubrics(r.data || [], c.data || [], l.data || [])
          this.rubricScores = (s.data || []).map((x: any) => ({ ...x, poin: Number(x.poin) })) as RubricScoreRow[]
          this.peerReviews = (p.data || []).map(toPeerReview)

          if (useAuthStore().isStudent) {
            const [tasks, received] = await Promise.all([
              supabase.rpc('get_peer_review_tasks'),
              supabase.rpc('get_received_peer_reviews'),
            ])
            if (tasks.error) throw tasks.error
            if (received.error) throw received.error
            this.peerTexts = Object.fromEntries(
              (tasks.data || []).map((t: any) => [t.review_id, { jawaban: t.jawaban ?? null, file_name: t.file_name ?? null }]),
            )
            this.receivedReviews = (received.data || []).map((x: any) => toPeerReview({ ...x, status: 'submitted' }))
          }
        } catch (err: any) {
          // Tables/RPCs missing (migration not applied) — keep the feature empty instead of mixing in demo data.
          console.error('Failed to fetch rubrics/peer reviews:', err)
          this.error = err?.message || 'Gagal memuat rubrik.'
        } finally {
          this.loading = false
        }
      }

      if (this.isDemoMode) this._syncDemo()
      this.initialized = true
      if (this.isDemoMode) this.syncPeerDeadlineReminders()
    },

    _syncDemo() {
      if (!this.isDemoMode) return
      this.rubrics = DEMO_RUBRICS.map(cloneRubric)
      this.rubricScores = DEMO_RUBRIC_SCORES.map((s) => ({ ...s }))
      this.peerReviews = DEMO_PEER_REVIEWS.map((r) => ({ ...r, selections: { ...r.selections } }))
    },

    _assignment(assignmentId: string) {
      const a = useAssignmentsStore()
      const list = a.isDemoMode ? a.assignments : a.sbAssignments
      return list.find((x) => x.id === assignmentId) || DEMO_ASSIGNMENTS.find((x) => x.id === assignmentId) || null
    },

    // ── Rubric CRUD ──────────────────────────────────────

    /** Create or replace the criteria of an assignment's rubric. Keeps the peer config. */
    async saveRubric(assignmentId: string, criteria: RubricCriterion[]): Promise<boolean> {
      const clean: RubricCriterion[] = criteria.map((c) => ({
        id: c.id || newRubricId('rc'),
        nama: (c.nama || '').trim(),
        deskripsi: (c.deskripsi || '').trim(),
        bobot: Number(c.bobot),
        levels: c.levels.map((l) => ({
          id: l.id || newRubricId('rl'),
          label: (l.label || '').trim(),
          deskripsi: (l.deskripsi || '').trim(),
          poin: Number(l.poin),
        })),
      }))
      this.error = validateRubricCriteria(clean)
      if (this.error) return false
      const now = new Date().toISOString()

      if (this.isDemoMode) {
        const idx = DEMO_RUBRICS.findIndex((r) => r.assignment_id === assignmentId)
        const oldCritIds = new Set(idx >= 0 ? DEMO_RUBRICS[idx]!.criteria.map((c) => c.id) : [])
        if (idx >= 0) DEMO_RUBRICS[idx] = { ...DEMO_RUBRICS[idx]!, criteria: clean, updated_at: now }
        else DEMO_RUBRICS.push({ id: demoId('rb'), assignment_id: assignmentId, criteria: clean, peer: { ...DEFAULT_PEER_CONFIG }, created_at: now, updated_at: now })
        // Instructor rubric scores of this rubric: drop removed criteria/levels, refresh poin.
        for (let i = DEMO_RUBRIC_SCORES.length - 1; i >= 0; i--) {
          const s = DEMO_RUBRIC_SCORES[i]!
          if (!oldCritIds.has(s.criterion_id)) continue
          const lv = clean.find((x) => x.id === s.criterion_id)?.levels.find((x) => x.id === s.level_id)
          if (lv) s.poin = lv.poin
          else DEMO_RUBRIC_SCORES.splice(i, 1)
        }
        this._syncDemo()
        return true
      }

      try {
        const supabase = useNuxtApp().$supabase
        const existing = this.rubricFor(assignmentId)
        const rubricId = existing?.id || newRubricId('rb')
        const auth = useAuthStore()
        const { error: rErr } = await supabase
          .from('rubrics')
          .upsert({ id: rubricId, assignment_id: assignmentId, created_by: auth.user?.id ?? null, updated_at: now }, { onConflict: 'assignment_id' })
        if (rErr) throw rErr

        const critRows = clean.map((c, i) => ({ id: c.id, rubric_id: rubricId, nama: c.nama, deskripsi: c.deskripsi || null, bobot: c.bobot, urutan: i }))
        const { error: cErr } = await supabase.from('rubric_criteria').upsert(critRows)
        if (cErr) throw cErr
        const critIds = clean.map((c) => c.id)
        const { error: cdErr } = await supabase
          .from('rubric_criteria').delete().eq('rubric_id', rubricId).not('id', 'in', `(${critIds.join(',')})`)
        if (cdErr) throw cdErr

        const levelRows = clean.flatMap((c) => c.levels.map((l, i) => ({ id: l.id, criterion_id: c.id, label: l.label, deskripsi: l.deskripsi || null, poin: l.poin, urutan: i })))
        const { error: lErr } = await supabase.from('rubric_levels').upsert(levelRows)
        if (lErr) throw lErr
        const levelIds = levelRows.map((l) => l.id)
        const { error: ldErr } = await supabase
          .from('rubric_levels').delete().in('criterion_id', critIds).not('id', 'in', `(${levelIds.join(',')})`)
        if (ldErr) throw ldErr

        const rubric: Rubric = existing
          ? { ...existing, criteria: clean, updated_at: now }
          : { id: rubricId, assignment_id: assignmentId, criteria: clean, peer: { ...DEFAULT_PEER_CONFIG }, created_at: now, updated_at: now }
        this.rubrics = [...this.rubrics.filter((r) => r.assignment_id !== assignmentId), rubric]
        const validLevels = new Set(levelIds)
        this.rubricScores = this.rubricScores.filter((s) => !critIds.includes(s.criterion_id) || validLevels.has(s.level_id))
        return true
      } catch (err: any) {
        this.error = err?.message || 'Gagal menyimpan rubrik.'
        return false
      }
    },

    /** Remove an assignment's rubric (and its peer reviews). Existing `nilai` stays. */
    async deleteRubric(assignmentId: string): Promise<boolean> {
      const rubric = this.rubricFor(assignmentId)
      if (!rubric) return true
      const critIds = new Set(rubric.criteria.map((c) => c.id))

      if (this.isDemoMode) {
        const idx = DEMO_RUBRICS.findIndex((r) => r.assignment_id === assignmentId)
        if (idx >= 0) DEMO_RUBRICS.splice(idx, 1)
        for (let i = DEMO_RUBRIC_SCORES.length - 1; i >= 0; i--) if (critIds.has(DEMO_RUBRIC_SCORES[i]!.criterion_id)) DEMO_RUBRIC_SCORES.splice(i, 1)
        for (let i = DEMO_PEER_REVIEWS.length - 1; i >= 0; i--) if (DEMO_PEER_REVIEWS[i]!.assignment_id === assignmentId) DEMO_PEER_REVIEWS.splice(i, 1)
        this._syncDemo()
        return true
      }

      try {
        const supabase = useNuxtApp().$supabase
        const { error: pErr } = await supabase.from('peer_reviews').delete().eq('assignment_id', assignmentId)
        if (pErr) throw pErr
        const { error } = await supabase.from('rubrics').delete().eq('id', rubric.id)
        if (error) throw error
        this.rubrics = this.rubrics.filter((r) => r.id !== rubric.id)
        this.rubricScores = this.rubricScores.filter((s) => !critIds.has(s.criterion_id))
        this.peerReviews = this.peerReviews.filter((r) => r.assignment_id !== assignmentId)
        return true
      } catch (err: any) {
        this.error = err?.message || 'Gagal menghapus rubrik.'
        return false
      }
    },

    // ── Rubric grading ───────────────────────────────────

    /**
     * Grade a submission with the rubric: stores the per-criterion levels and
     * saves `nilai` through the normal grading path. `nilai` defaults to the
     * rubric total; the instructor may pass an adjusted value.
     * Returns the saved score, or null on error.
     */
    async gradeWithRubric(submissionId: string, assignmentId: string, selection: RubricSelection, feedback: string, nilai?: number): Promise<number | null> {
      const rubric = this.rubricFor(assignmentId)
      if (!rubric) {
        this.error = 'Tugas ini belum punya rubrik.'
        return null
      }
      const sel = sanitizeSelection(rubric.criteria, selection)
      const score = computeRubricScore(rubric.criteria, sel)
      if (!score.complete) {
        this.error = 'Pilih level untuk setiap kriteria rubrik.'
        return null
      }
      const final = typeof nilai === 'number' && Number.isFinite(nilai) ? Math.max(0, Math.min(100, Math.round(nilai))) : score.total
      this.error = null
      const critIds = new Set(rubric.criteria.map((c) => c.id))
      const rows: RubricScoreRow[] = score.breakdown.map((b) => ({
        id: newRubricId('rs'),
        submission_id: submissionId,
        criterion_id: b.criterion_id,
        level_id: b.level_id!,
        poin: b.poin!,
      }))

      if (this.isDemoMode) {
        for (let i = DEMO_RUBRIC_SCORES.length - 1; i >= 0; i--) {
          const s = DEMO_RUBRIC_SCORES[i]!
          if (s.submission_id === submissionId && critIds.has(s.criterion_id)) DEMO_RUBRIC_SCORES.splice(i, 1)
        }
        DEMO_RUBRIC_SCORES.push(...rows)
        this._syncDemo()
      } else {
        try {
          const supabase = useNuxtApp().$supabase
          const auth = useAuthStore()
          const { error } = await supabase.from('rubric_scores').upsert(
            rows.map(({ id: _id, ...r }) => ({ ...r, graded_by: auth.user?.id ?? null, updated_at: new Date().toISOString() })),
            { onConflict: 'submission_id,criterion_id' },
          )
          if (error) throw error
          this.rubricScores = [
            ...this.rubricScores.filter((s) => !(s.submission_id === submissionId && critIds.has(s.criterion_id))),
            ...rows,
          ]
        } catch (err: any) {
          this.error = err?.message || 'Gagal menyimpan skor rubrik.'
          return null
        }
      }

      await useAssignmentsStore().gradeSubmission(submissionId, final, feedback)
      return final
    },

    // ── Peer review ──────────────────────────────────────

    async savePeerConfig(assignmentId: string, cfg: PeerReviewConfig): Promise<boolean> {
      const rubric = this.rubricFor(assignmentId)
      if (!rubric) {
        this.error = 'Buat rubrik terlebih dahulu: peer review memakai rubrik tugas.'
        return false
      }
      const next: PeerReviewConfig = {
        enabled: !!cfg.enabled,
        reviewers_per_submission: Number(cfg.reviewers_per_submission),
        deadline: cfg.deadline || null,
        weight: Number(cfg.weight),
        assigned_at: rubric.peer.assigned_at ?? null,
      }
      this.error = validatePeerConfig(next)
      if (this.error) return false

      if (this.isDemoMode) {
        const r = DEMO_RUBRICS.find((x) => x.assignment_id === assignmentId)
        if (r) r.peer = next
        this._syncDemo()
        return true
      }
      try {
        const { error } = await useNuxtApp().$supabase
          .from('rubrics')
          .update({
            peer_enabled: next.enabled,
            peer_reviewers: next.reviewers_per_submission,
            peer_deadline: next.deadline,
            peer_weight: next.weight,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rubric.id)
        if (error) throw error
        this.rubrics = this.rubrics.map((r) => (r.id === rubric.id ? { ...r, peer: next } : r))
        return true
      } catch (err: any) {
        this.error = err?.message || 'Gagal menyimpan pengaturan peer review.'
        return false
      }
    },

    /**
     * Randomly assign reviewers among students who submitted (balanced, never
     * self). Replaces earlier assignments as long as no review was submitted.
     */
    async assignPeerReviews(assignmentId: string, now: number = Date.now()): Promise<{ created: number; effectiveK: number; note: string | null } | null> {
      const rubric = this.rubricFor(assignmentId)
      if (!rubric?.peer.enabled) {
        this.error = 'Aktifkan peer review terlebih dahulu.'
        return null
      }
      const existing = this.reviewsForAssignment(assignmentId)
      if (existing.some((r) => r.status === 'submitted')) {
        this.error = 'Sudah ada review yang dikirim, jadi penugasan tidak bisa diacak ulang.'
        return null
      }
      const subs = useAssignmentsStore()
        .submissionsForAssignment(assignmentId)
        .filter((s) => (s.jawaban && s.jawaban.trim() && s.jawaban !== '(Dinilai langsung)') || s.file_url)
        .map((s) => ({ submission_id: s.id, student_id: s.student_id }))
      const result = assignReviewers(subs, rubric.peer.reviewers_per_submission, `${assignmentId}:${now}`)
      if (result.pairs.length === 0) {
        this.error = result.note || 'Tidak ada pasangan reviewer yang bisa dibuat.'
        return null
      }
      this.error = null
      const createdAt = new Date(now).toISOString()
      const rows: PeerReview[] = result.pairs.map((p) => ({
        id: this.isDemoMode ? demoId('pr') : newRubricId('pr'),
        assignment_id: assignmentId,
        submission_id: p.submission_id,
        reviewer_id: p.reviewer_id,
        status: 'assigned',
        selections: {},
        komentar: '',
        skor: null,
        override_skor: null,
        override_note: null,
        excluded: false,
        submitted_at: null,
        created_at: createdAt,
      }))

      if (this.isDemoMode) {
        for (let i = DEMO_PEER_REVIEWS.length - 1; i >= 0; i--) if (DEMO_PEER_REVIEWS[i]!.assignment_id === assignmentId) DEMO_PEER_REVIEWS.splice(i, 1)
        DEMO_PEER_REVIEWS.push(...rows)
        const r = DEMO_RUBRICS.find((x) => x.assignment_id === assignmentId)
        if (r) r.peer = { ...r.peer, assigned_at: createdAt }
        this._syncDemo()
        this._notifyAssigned(assignmentId, rows, createdAt)
      } else {
        try {
          const supabase = useNuxtApp().$supabase
          const { error: dErr } = await supabase.from('peer_reviews').delete().eq('assignment_id', assignmentId)
          if (dErr) throw dErr
          const { error } = await supabase.from('peer_reviews').insert(
            rows.map((r) => ({ id: r.id, assignment_id: r.assignment_id, submission_id: r.submission_id, reviewer_id: r.reviewer_id, status: 'assigned' })),
          )
          if (error) throw error
          await supabase.from('rubrics').update({ peer_assigned_at: createdAt }).eq('id', rubric.id)
          this.peerReviews = [...this.peerReviews.filter((r) => r.assignment_id !== assignmentId), ...rows]
          this.rubrics = this.rubrics.map((x) => (x.id === rubric.id ? { ...x, peer: { ...x.peer, assigned_at: createdAt } } : x))
          // Notifications are created by the trg_notify_peer_review_assigned trigger.
        } catch (err: any) {
          this.error = err?.message || 'Gagal menugaskan reviewer.'
          return null
        }
      }
      return { created: rows.length, effectiveK: result.effectiveK, note: result.note }
    },

    /** Demo: tell each reviewer about their tasks (production: Postgres trigger). */
    _notifyAssigned(assignmentId: string, rows: PeerReview[], stamp: string) {
      const rubric = this.rubricFor(assignmentId)
      const judul = this._assignment(assignmentId)?.judul || 'Tugas'
      const counts: Record<string, number> = {}
      for (const r of rows) counts[r.reviewer_id] = (counts[r.reviewer_id] ?? 0) + 1
      const notifications = useNotificationsStore()
      const deadline = rubric?.peer.deadline
        ? ` · tenggat ${new Date(rubric.peer.deadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}`
        : ''
      for (const [uid, n] of Object.entries(counts)) {
        notifications.notifyUsers([uid], {
          tipe: 'tugas',
          judul: `Peer review: ${judul}`,
          pesan: `Anda diminta menilai ${n} jawaban teman secara anonim${deadline}`,
          link: `/assignments/${assignmentId}`,
          dedupe_key: `peer-assign:${assignmentId}:${stamp}`,
        })
      }
    },

    /** Student: submit (or update before the deadline) a rubric-based review. */
    async submitPeerReview(reviewId: string, selection: RubricSelection, komentar: string, now: number = Date.now()): Promise<boolean> {
      const uid = useAuthStore().user?.id
      const review = this.peerReviews.find((r) => r.id === reviewId)
      if (!review || review.reviewer_id !== uid) {
        this.error = 'Review tidak ditemukan.'
        return false
      }
      const rubric = this.rubricFor(review.assignment_id)
      if (!rubric) {
        this.error = 'Rubrik tugas tidak ditemukan.'
        return false
      }
      if (!isReviewOpen(rubric.peer.deadline, now)) {
        this.error = 'Tenggat peer review sudah lewat.'
        return false
      }
      const sel = sanitizeSelection(rubric.criteria, selection)
      const score = computeRubricScore(rubric.criteria, sel)
      if (!score.complete) {
        this.error = 'Pilih level untuk setiap kriteria.'
        return false
      }
      const text = (komentar || '').trim().slice(0, 2000)
      if (text.length < 10) {
        this.error = 'Tulis komentar minimal 10 karakter agar review bermanfaat.'
        return false
      }
      this.error = null
      const patch = { selections: sel, komentar: text, skor: score.exact, status: 'submitted' as const, submitted_at: new Date(now).toISOString() }

      if (this.isDemoMode) {
        const r = DEMO_PEER_REVIEWS.find((x) => x.id === reviewId)
        if (r) Object.assign(r, patch)
        this._syncDemo()
        return true
      }
      try {
        const { error } = await useNuxtApp().$supabase.from('peer_reviews').update(patch).eq('id', reviewId)
        if (error) throw error
        this.peerReviews = this.peerReviews.map((r) => (r.id === reviewId ? { ...r, ...patch } : r))
        return true
      } catch (err: any) {
        this.error = err?.message || 'Gagal mengirim review.'
        return false
      }
    },

    /** Instructor: override a review's score (null clears) and/or exclude it from the average. */
    async overridePeerReview(reviewId: string, patch: { override_skor?: number | null; excluded?: boolean; override_note?: string | null }): Promise<boolean> {
      const review = this.peerReviews.find((r) => r.id === reviewId)
      if (!review) {
        this.error = 'Review tidak ditemukan.'
        return false
      }
      const next: Partial<PeerReview> = {}
      if (patch.override_skor !== undefined) {
        const v = patch.override_skor
        if (v !== null && (!Number.isFinite(v) || v < 0 || v > 100)) {
          this.error = 'Skor pengganti harus 0–100.'
          return false
        }
        next.override_skor = v === null ? null : Math.round(v * 10) / 10
      }
      if (patch.excluded !== undefined) next.excluded = !!patch.excluded
      if (patch.override_note !== undefined) next.override_note = patch.override_note ? patch.override_note.slice(0, 500) : null
      this.error = null

      if (this.isDemoMode) {
        const r = DEMO_PEER_REVIEWS.find((x) => x.id === reviewId)
        if (r) Object.assign(r, next)
        this._syncDemo()
        return true
      }
      try {
        const { error } = await useNuxtApp().$supabase.from('peer_reviews').update(next).eq('id', reviewId)
        if (error) throw error
        this.peerReviews = this.peerReviews.map((r) => (r.id === reviewId ? { ...r, ...next } : r))
        return true
      } catch (err: any) {
        this.error = err?.message || 'Gagal menyimpan perubahan review.'
        return false
      }
    },

    /**
     * Demo: remind the signed-in student of pending reviews whose deadline is
     * within PEER_REMINDER_HOURS. (Production: notify_peer_review_deadlines() via cron.)
     */
    syncPeerDeadlineReminders(now: number = Date.now()): number {
      const auth = useAuthStore()
      if (!this.isDemoMode || !auth.isStudent || !auth.user) return 0
      const uid = auth.user.id
      const windowMs = PEER_REMINDER_HOURS * 3600 * 1000
      const pending: Record<string, number> = {}
      for (const r of this.peerReviews) {
        if (r.reviewer_id !== uid || r.status !== 'assigned') continue
        pending[r.assignment_id] = (pending[r.assignment_id] ?? 0) + 1
      }
      let created = 0
      for (const [assignmentId, n] of Object.entries(pending)) {
        const deadline = this.rubricFor(assignmentId)?.peer.deadline
        if (!deadline) continue
        const due = new Date(deadline).getTime()
        if (Number.isNaN(due) || due <= now || due - now > windowMs) continue
        created += useNotificationsStore().notifyUsers(
          [uid],
          {
            tipe: 'deadline',
            judul: `Tenggat peer review: ${this._assignment(assignmentId)?.judul || 'Tugas'}`,
            pesan: `${n} review belum dikirim · tenggat ${new Date(deadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}`,
            link: `/assignments/${assignmentId}`,
            dedupe_key: `peer-deadline:${assignmentId}:${deadline}`,
          },
          true,
        )
      }
      return created
    },

    /** Reset (logout/tests). Demo data survives, like the other stores. */
    reset() {
      this.initialized = false
      this.peerTexts = {}
      this.receivedReviews = []
    },
  },
})
