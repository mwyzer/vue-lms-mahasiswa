<script setup lang="ts">
/**
 * PeerFeedback — student: anonymous reviews of their own submission and how
 * the peer average enters the final assignment score.
 */
import { computed } from 'vue'

const props = defineProps<{ assignmentId: string; submissionId: string; instructorScore?: number | null }>()

const rubrics = useRubricsStore()
const rubric = computed(() => rubrics.rubricFor(props.assignmentId))
const reviews = computed(() => rubrics.myReceivedReviews(props.submissionId))
const summary = computed(() => rubrics.peerSummaryFor(props.submissionId))
const final = computed(() =>
  rubrics.finalScoreFor({ id: props.submissionId, assignment_id: props.assignmentId, nilai: props.instructorScore ?? null }),
)
</script>

<template>
  <div v-if="rubric?.peer.enabled" class="peer-feedback">
    <h4>👥 Review dari teman (anonim)</h4>
    <p v-if="reviews.length === 0" class="pf-muted">Belum ada review yang masuk untuk jawabanmu.</p>

    <template v-else>
      <div class="pf-summary">
        <span>Rata-rata nilai peer: <strong>{{ summary?.average ?? '–' }}</strong></span>
        <span class="pf-muted">dari {{ reviews.length }} review · bobot {{ rubric.peer.weight }}% ke nilai akhir</span>
      </div>
      <p v-if="instructorScore != null" class="pf-final">
        Nilai akhir tugas = {{ instructorScore }} (dosen) × {{ 100 - rubric.peer.weight }}% + {{ summary?.average ?? '–' }} (peer) ×
        {{ rubric.peer.weight }}% = <strong>{{ final }}</strong>
      </p>

      <details v-for="r in reviews" :key="r.id" class="pf-review">
        <summary>
          <strong>{{ r.label }}</strong>
          <span class="badge badge-neutral">Skor {{ r.skor ?? '–' }}</span>
        </summary>
        <p v-if="r.komentar" class="pf-comment">{{ r.komentar }}</p>
        <RubricGrader
          :criteria="rubric.criteria"
          :model-value="r.selections"
          readonly
          :title="`Penilaian ${r.label}`"
        />
      </details>
    </template>
  </div>
</template>

<style scoped>
.peer-feedback {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-neutral-200);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.peer-feedback h4 {
  font-size: 0.9375rem;
}

.pf-muted {
  font-size: 0.8125rem;
  color: var(--color-neutral-500);
}

.pf-summary {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  flex-wrap: wrap;
  font-size: 0.875rem;
}

.pf-final {
  font-size: 0.8125rem;
  color: var(--color-neutral-700);
  padding: 0.375rem 0.625rem;
  border-left: 3px solid var(--color-primary-300);
  background: var(--color-neutral-50);
}

.pf-review {
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
  background: var(--color-surface);
}

.pf-review summary {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pf-review[open] summary {
  margin-bottom: 0.5rem;
}

.pf-comment {
  font-size: 0.875rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin-bottom: 0.5rem;
  color: var(--color-neutral-800);
}
</style>
