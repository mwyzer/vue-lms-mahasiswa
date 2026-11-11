<script setup lang="ts">
/**
 * PlagiarismResults — Renders a plagiarism-check report: flagged pairs with
 * both scores (lexical + semantic), a match-type badge, a one-line
 * explanation of each score and an honest note about the semantic mode.
 *
 * Wording is deliberately neutral: a high score is a signal for the
 * instructor to review, never proof of plagiarism.
 */
import type { PlagiarismReport, PlagiarismPair } from '~/composables/usePlagiarism'

const props = defineProps<{ report: PlagiarismReport }>()

const semantic = computed(() => props.report.semantic ?? null)
const pairs = computed<PlagiarismPair[]>(() => plagiarismSortPairs(props.report.pairs ?? []))

const semanticThreshold = computed(() => semantic.value?.effective_threshold ?? semantic.value?.threshold ?? null)

const modeLabel = computed(() => {
  const m = semantic.value?.mode
  if (m === 'api') return 'embedding AI'
  if (m === 'local') return 'aproksimasi offline'
  if (m === 'unavailable') return 'tidak tersedia'
  return null
})

/** Excerpt of `otherId`'s answer as seen from `fromId` (from the per-submission results). */
function excerptOf(fromId: string, otherId: string): string {
  const r = props.report.checked.find((c) => c.submissionId === fromId)
  return r?.matches.find((m) => m.withId === otherId)?.excerpt ?? ''
}

function semanticText(p: PlagiarismPair): string {
  if (p.semantic_similarity !== null) return `${p.semantic_similarity}%`
  return '—'
}

function semanticTitle(p: PlagiarismPair): string {
  if (p.semantic_skipped === 'short') return `Jawaban di bawah ${semantic.value?.min_words ?? 20} kata tidak dibandingkan secara semantik`
  if (p.semantic_skipped === 'unavailable') return 'Skor semantik tidak tersedia untuk pemeriksaan ini'
  if (p.semantic_truncated) return 'Jawaban panjang: hanya bagian awal yang dibandingkan secara semantik'
  return 'Kemiripan makna (cosine similarity embedding)'
}

function scoreClass(score: number | null, threshold: number | null): string {
  if (score === null || threshold === null) return 'score-muted'
  return score >= threshold ? 'score-hit' : 'score-plain'
}
</script>

<template>
  <div class="plag-results">
    <p v-if="report.total < 2" class="text-sm plag-muted">
      Perlu minimal 2 jawaban teks untuk pemeriksaan.
    </p>

    <template v-else>
      <p class="text-sm plag-summary">
        Membandingkan <strong>{{ report.total }}</strong> jawaban teks. Ambang:
        leksikal <strong>&ge; {{ report.threshold }}%</strong><template v-if="semanticThreshold !== null">,
          semantik <strong>&ge; {{ semanticThreshold }}%</strong></template><template v-if="modeLabel">
          ({{ modeLabel }})</template>.
      </p>

      <ul class="plag-legend text-sm">
        <li><strong>Leksikal</strong>: porsi rangkaian 3 kata yang persis sama — menandai salin-tempel.</li>
        <li>
          <strong>Semantik</strong>: kemiripan makna dari embedding
          <template v-if="semantic?.mode === 'api'">AI — dapat menandai parafrase (kata berbeda, isi sama).</template>
          <template v-else>— hanya bermakna penuh dengan kunci API AI.</template>
        </li>
      </ul>

      <div
        v-if="semantic && semantic.mode !== 'api' && semantic.note"
        class="plag-note"
        :class="semantic.mode === 'unavailable' ? 'plag-note-warn' : 'plag-note-info'"
        role="note"
        data-testid="plag-semantic-note"
      >
        <strong>{{ semantic.mode === 'unavailable' ? 'Skor semantik tidak tersedia.' : 'Mode aproksimasi offline.' }}</strong>
        {{ semantic.note }}
      </div>
      <p
        v-else-if="semantic?.note"
        class="text-sm plag-muted plag-note-plain"
        data-testid="plag-semantic-note"
      >
        {{ semantic.note }}
      </p>

      <div v-if="pairs.length === 0" class="plag-empty" data-testid="plag-empty">
        Tidak ada pasangan jawaban dengan kemiripan di atas ambang.
      </div>

      <ol v-else class="plag-pairs">
        <li
          v-for="p in pairs"
          :key="`${p.a_id}-${p.b_id}`"
          class="plag-pair"
          data-testid="plag-pair"
        >
          <div class="plag-pair-head">
            <span class="plag-names">
              <strong>{{ p.a_name }}</strong><span aria-hidden="true"> ↔ </span><span class="sr-only"> dan </span><strong>{{ p.b_name }}</strong>
            </span>
            <span class="plag-type" :class="`plag-type-${p.match_type}`">
              {{ plagiarismMatchLabel(p.match_type, semantic?.mode) }}
            </span>
          </div>

          <div class="plag-scores">
            <span
              class="plag-score"
              :class="scoreClass(p.similarity, report.threshold)"
              title="Kesamaan rangkaian kata (Jaccard 3-gram)"
            >
              Leksikal {{ p.similarity }}%
            </span>
            <span
              class="plag-score"
              :class="scoreClass(p.semantic_similarity, semanticThreshold)"
              :title="semanticTitle(p)"
            >
              Semantik {{ semanticText(p) }}<template v-if="p.semantic_truncated">*</template>
            </span>
          </div>

          <p class="plag-hint text-sm">Kemiripan tinggi — perlu ditinjau.</p>

          <details class="plag-excerpts">
            <summary class="text-sm">Lihat cuplikan jawaban</summary>
            <p class="plag-excerpt"><strong>{{ p.a_name }}:</strong> “{{ excerptOf(p.b_id, p.a_id) }}”</p>
            <p class="plag-excerpt"><strong>{{ p.b_name }}:</strong> “{{ excerptOf(p.a_id, p.b_id) }}”</p>
          </details>
        </li>
      </ol>

      <p class="text-xs plag-muted plag-disclaimer">
        Skor ini adalah sinyal untuk ditinjau, bukan bukti plagiarisme. Jawaban untuk soal yang sama wajar memiliki
        topik dan istilah yang mirip.
      </p>
    </template>
  </div>
</template>

<style scoped>
.plag-results {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  color: var(--color-neutral-800);
}

.plag-summary {
  margin: 0;
  color: var(--color-neutral-700);
}

.plag-muted {
  margin: 0;
  color: var(--color-neutral-500);
}

.plag-legend {
  margin: 0;
  padding-left: 1.1rem;
  color: var(--color-neutral-600);
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.plag-note {
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  line-height: 1.45;
  border: 1px solid;
}

.plag-note-info {
  border-color: color-mix(in srgb, var(--color-info) 55%, transparent);
  background: color-mix(in srgb, var(--color-info) 10%, transparent);
  color: var(--color-neutral-800);
}

.plag-note-warn {
  border-color: color-mix(in srgb, var(--color-warning) 60%, transparent);
  background: color-mix(in srgb, var(--color-warning) 12%, transparent);
  color: var(--color-neutral-800);
}

.plag-note-plain {
  margin: 0;
}

.plag-empty {
  padding: 0.75rem;
  border: 1px solid var(--color-success);
  background: color-mix(in srgb, var(--color-success) 12%, transparent);
  color: var(--color-neutral-800);
  border-radius: 8px;
  font-size: 0.875rem;
}

.plag-pairs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.plag-pair {
  padding: 0.625rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--color-error) 45%, transparent);
  background: color-mix(in srgb, var(--color-error) 6%, var(--color-surface));
  border-radius: 8px;
  min-width: 0;
}

.plag-pair-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.plag-names {
  font-size: 0.875rem;
  color: var(--color-neutral-900);
  overflow-wrap: anywhere;
}

.plag-type {
  display: inline-flex;
  padding: 0.1rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid;
  white-space: nowrap;
}

.plag-type-lexical {
  color: var(--color-error);
  border-color: color-mix(in srgb, var(--color-error) 60%, transparent);
  background: color-mix(in srgb, var(--color-error) 12%, transparent);
}

.plag-type-semantic {
  color: var(--color-primary-600);
  border-color: color-mix(in srgb, var(--color-primary-600) 60%, transparent);
  background: color-mix(in srgb, var(--color-primary-600) 12%, transparent);
}

.plag-type-both {
  color: var(--color-warning);
  border-color: color-mix(in srgb, var(--color-warning) 60%, transparent);
  background: color-mix(in srgb, var(--color-warning) 14%, transparent);
}

.plag-scores {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.4rem;
}

.plag-score {
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--color-neutral-200);
  background: var(--color-surface);
  color: var(--color-neutral-700);
  font-variant-numeric: tabular-nums;
}

.plag-score.score-hit {
  border-color: color-mix(in srgb, var(--color-error) 60%, transparent);
  color: var(--color-error);
}

.plag-score.score-muted {
  color: var(--color-neutral-500);
}

.plag-hint {
  margin: 0.35rem 0 0;
  color: var(--color-neutral-600);
}

.plag-excerpts {
  margin-top: 0.35rem;
}

.plag-excerpts summary {
  cursor: pointer;
  color: var(--color-primary-600);
}

.plag-excerpt {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
  color: var(--color-neutral-600);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.plag-disclaimer {
  margin: 0;
  font-size: 0.75rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
