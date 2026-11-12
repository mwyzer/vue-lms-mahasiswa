<script setup lang="ts">
/**
 * FlashcardReviewSession — flip-card review of the cards due today (SM-2).
 *
 * The queue is snapshotted when the session starts, so rescheduled cards don't
 * jump around. Space/Enter flips; after flipping, keys 1–4 = Lagi/Sulit/Bagus/
 * Mudah, or 0–5 in "mode 0–5".
 */
import { useFlashcardsStore } from '~/stores/flashcards'
import { SM2_BUTTONS, SM2_QUALITY_LABELS, formatInterval, previewIntervals, toLocalDateKey, type Sm2Quality } from '~/utils/sm2'

const props = defineProps<{ courseId?: string | null }>()

const store = useFlashcardsStore()

const queue = ref<string[]>([])
const index = ref(0)
const flipped = ref(false)
const advanced = ref(false)
const busy = ref(false)
const results = ref<Sm2Quality[]>([])
const started = ref(false)

const due = computed(() => {
  const list = store.dueCards(toLocalDateKey())
  return props.courseId ? list.filter((c) => c.course_id === props.courseId) : list
})

const current = computed(() => {
  const id = queue.value[index.value]
  return id ? store.myCards.find((c) => c.id === id) ?? null : null
})
const finished = computed(() => started.value && index.value >= queue.value.length)
const preview = computed(() => (current.value ? previewIntervals(current.value) : null))

const nextDue = computed(() => {
  const upcoming = store.myCards.map((c) => c.due_date).sort()
  return upcoming.find((d) => d > toLocalDateKey()) ?? null
})

function start() {
  queue.value = due.value.map((c) => c.id)
  index.value = 0
  flipped.value = false
  results.value = []
  started.value = true
}

watch(() => props.courseId, () => { started.value = false })

function flip() {
  if (current.value) flipped.value = !flipped.value
}

async function grade(q: Sm2Quality) {
  if (!current.value || !flipped.value || busy.value) return
  busy.value = true
  const ok = await store.reviewCard(current.value.id, q)
  busy.value = false
  if (!ok) return
  results.value.push(q)
  index.value++
  flipped.value = false
}

function onKey(e: KeyboardEvent) {
  if (!started.value || finished.value) return
  const target = e.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  if (e.key === ' ' || e.key === 'Enter') {
    if (target?.tagName === 'BUTTON' && e.key === 'Enter') return
    e.preventDefault()
    flip()
    return
  }
  if (!flipped.value) return
  const n = Number(e.key)
  if (!Number.isInteger(n)) return
  if (advanced.value && n >= 0 && n <= 5) grade(n as Sm2Quality)
  else if (!advanced.value && n >= 1 && n <= 4) grade(SM2_BUTTONS[n - 1]!.quality)
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const correctCount = computed(() => results.value.filter((q) => q >= 3).length)
</script>

<template>
  <div class="frs">
    <!-- Not started -->
    <div v-if="!started" class="card frs-start">
      <template v-if="due.length > 0">
        <p class="frs-big" data-testid="due-count">{{ due.length }}</p>
        <p class="text-muted">kartu jatuh tempo hari ini</p>
        <button type="button" class="btn btn-primary" data-testid="start-review" @click="start">Mulai Review</button>
      </template>
      <template v-else>
        <p class="frs-emoji" aria-hidden="true">✅</p>
        <p data-testid="no-due">Tidak ada kartu yang jatuh tempo hari ini.</p>
        <p v-if="nextDue" class="text-sm text-muted">Review berikutnya: {{ nextDue }}</p>
      </template>
    </div>

    <!-- Finished -->
    <div v-else-if="finished" class="card frs-start" data-testid="review-done">
      <p class="frs-emoji" aria-hidden="true">🎉</p>
      <p><strong>Sesi selesai!</strong> {{ results.length }} kartu direview, {{ correctCount }} diingat.</p>
      <div class="frs-row">
        <button v-if="due.length > 0" type="button" class="btn btn-secondary btn-sm" @click="start">Review lagi ({{ due.length }})</button>
        <button type="button" class="btn btn-ghost btn-sm" @click="started = false">Kembali</button>
      </div>
    </div>

    <!-- Reviewing -->
    <template v-else-if="current">
      <div class="frs-progress">
        <span class="text-sm text-muted">Kartu {{ index + 1 }} / {{ queue.length }}</span>
        <label class="frs-mode text-sm">
          <input v-model="advanced" type="checkbox" data-testid="advanced-mode" />
          Mode 0–5
        </label>
      </div>

      <button
        type="button"
        class="frs-card"
        :class="{ flipped }"
        :aria-label="flipped ? 'Sisi belakang kartu. Klik untuk membalik.' : 'Sisi depan kartu. Klik untuk melihat jawaban.'"
        data-testid="flip-card"
        @click="flip"
      >
        <span class="frs-inner">
          <span class="frs-face frs-front">
            <span class="frs-side">Pertanyaan</span>
            <span class="frs-text">{{ current.front }}</span>
            <span class="frs-hint text-xs">Klik atau tekan Spasi untuk membalik</span>
          </span>
          <span class="frs-face frs-back" :aria-hidden="!flipped">
            <span class="frs-side">Jawaban</span>
            <span class="frs-text">{{ current.back }}</span>
          </span>
        </span>
      </button>

      <div v-if="flipped && preview" class="frs-grades" role="group" aria-label="Seberapa baik kamu mengingat?">
        <template v-if="!advanced">
          <button
            v-for="(b, i) in SM2_BUTTONS"
            :key="b.key"
            type="button"
            class="btn frs-grade"
            :class="`g-${b.key}`"
            :disabled="busy"
            :data-testid="`grade-${b.key}`"
            @click="grade(b.quality)"
          >
            <span>{{ b.label }}</span>
            <span class="text-xs frs-interval">{{ formatInterval(preview[b.quality]) }} · {{ i + 1 }}</span>
          </button>
        </template>
        <template v-else>
          <button
            v-for="q in ([0, 1, 2, 3, 4, 5] as Sm2Quality[])"
            :key="q"
            type="button"
            class="btn frs-grade"
            :class="q < 3 ? 'g-lagi' : q === 3 ? 'g-sulit' : q === 4 ? 'g-bagus' : 'g-mudah'"
            :title="SM2_QUALITY_LABELS[q]"
            :disabled="busy"
            :data-testid="`grade-q${q}`"
            @click="grade(q)"
          >
            <span>{{ q }}</span>
            <span class="text-xs frs-interval">{{ formatInterval(preview[q]) }}</span>
          </button>
        </template>
      </div>
      <p v-if="store.error" class="frs-error text-sm" role="alert">{{ store.error }}</p>
    </template>
  </div>
</template>

<style scoped>
.frs { display: flex; flex-direction: column; gap: 1rem; }
.frs-start { padding: 2rem 1.5rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: var(--color-neutral-800); }
.frs-big { font-size: 2.75rem; font-weight: 700; font-family: var(--font-display); color: var(--color-accent); line-height: 1; }
.frs-emoji { font-size: 2.25rem; }
.frs-row { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.frs-progress { display: flex; justify-content: space-between; align-items: center; }
.frs-mode { white-space: nowrap; display: inline-flex; gap: 0.4rem; align-items: center; color: var(--color-neutral-500); cursor: pointer; }

.frs-card {
  display: block; width: 100%; min-height: 240px; padding: 0; border: none; background: none;
  perspective: 1200px; cursor: pointer; font: inherit; color: inherit; text-align: center;
}
.frs-card:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 4px; border-radius: var(--radius-lg); }
.frs-inner {
  position: relative; display: block; width: 100%; min-height: 240px;
  transform-style: preserve-3d; transition: transform var(--dur-slow) var(--ease-out);
}
.frs-card.flipped .frs-inner { transform: rotateY(180deg); }
.frs-face {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem;
  padding: 1.5rem; border-radius: var(--radius-lg); backface-visibility: hidden; -webkit-backface-visibility: hidden;
  background: var(--color-surface); border: 1px solid var(--color-neutral-200); box-shadow: var(--shadow-card); color: var(--color-neutral-800);
}
.frs-back { transform: rotateY(180deg); background: var(--color-accent-soft); border-color: var(--color-accent); }
.frs-side { font-family: var(--font-label); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-neutral-500); }
.frs-text { font-size: 1.15rem; line-height: 1.5; white-space: pre-wrap; max-width: 60ch; }
.frs-hint { color: var(--color-neutral-500); }

.frs-grades { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 0.5rem; }
.frs-grade { display: flex; flex-direction: column; gap: 0.15rem; padding: 0.6rem 0.5rem; border: 1px solid var(--color-neutral-200); background: var(--color-surface); color: var(--color-neutral-800); }
.frs-grade:hover:not(:disabled) { background: var(--color-neutral-100); }
.frs-interval { color: var(--color-neutral-500); }
.g-lagi { border-color: var(--tint-danger-border, var(--color-error)); color: var(--color-error); }
.g-sulit { border-color: var(--tint-warning-border, var(--color-warning)); color: var(--color-warning); }
.g-bagus { border-color: var(--tint-success-border, var(--color-success)); color: var(--color-success); }
.g-mudah { border-color: var(--tint-info-border, var(--color-info)); color: var(--color-info); }
.frs-error { color: var(--color-error); }

@media (prefers-reduced-motion: reduce) {
  .frs-inner { transition: none; }
}
</style>
