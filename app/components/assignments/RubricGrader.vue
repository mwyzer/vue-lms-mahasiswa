<script setup lang="ts">
/**
 * RubricGrader — pick one level per criterion; shows the live total.
 *
 * Used for instructor grading, peer reviews (editable) and, with `readonly`,
 * to show a rubric to students (optionally highlighting the chosen levels).
 */
import { computed } from 'vue'
import { computeRubricScore, type RubricCriterion, type RubricSelection } from '#shared/rubric'

const props = withDefaults(
  defineProps<{
    criteria: RubricCriterion[]
    modelValue?: RubricSelection | null
    readonly?: boolean
    /** Show the total score row. */
    showTotal?: boolean
    /** Optional reason per criterion (e.g. AI suggestion) shown under it. */
    notes?: Record<string, string> | null
    /** Accessible name / heading. */
    title?: string
  }>(),
  { modelValue: null, readonly: false, showTotal: true, notes: null, title: 'Rubrik penilaian' },
)

const emit = defineEmits<{ 'update:modelValue': [value: RubricSelection] }>()

const uid = `rg-${Math.random().toString(36).slice(2, 8)}`
const selection = computed<RubricSelection>(() => props.modelValue || {})
const score = computed(() => computeRubricScore(props.criteria, selection.value))
const hasSelection = computed(() => Object.keys(selection.value).length > 0)

function choose(criterionId: string, levelId: string) {
  if (props.readonly) return
  emit('update:modelValue', { ...selection.value, [criterionId]: levelId })
}

const contribution = (id: string) => score.value.breakdown.find((b) => b.criterion_id === id)
</script>

<template>
  <section class="rubric-grader" :aria-labelledby="`${uid}-title`">
    <div class="rg-head">
      <span :id="`${uid}-title`" class="rg-title">{{ title }}</span>
      <span class="rg-muted">{{ criteria.length }} kriteria · total bobot 100%</span>
    </div>

    <fieldset
      v-for="c in criteria"
      :key="c.id"
      class="rg-criterion"
      :disabled="readonly"
    >
      <legend class="rg-legend">
        <span class="rg-name">{{ c.nama }}</span>
        <span class="rg-weight">{{ c.bobot }}%</span>
      </legend>
      <p v-if="c.deskripsi" class="rg-desc">{{ c.deskripsi }}</p>

      <div class="rg-levels" role="radiogroup" :aria-label="c.nama">
        <label
          v-for="l in c.levels"
          :key="l.id"
          class="rg-level"
          :class="{ selected: selection[c.id] === l.id, readonly }"
        >
          <input
            type="radio"
            class="rg-radio"
            :name="`${uid}-${c.id}`"
            :value="l.id"
            :checked="selection[c.id] === l.id"
            :disabled="readonly"
            @change="choose(c.id, l.id)"
          />
          <span class="rg-level-top">
            <span class="rg-level-label">{{ l.label }}</span>
            <span class="rg-level-poin">{{ l.poin }} poin</span>
          </span>
          <span v-if="l.deskripsi" class="rg-level-desc">{{ l.deskripsi }}</span>
        </label>
      </div>

      <p v-if="notes?.[c.id]" class="rg-note">💡 {{ notes[c.id] }}</p>
      <p v-if="hasSelection && contribution(c.id)?.level_id" class="rg-contrib">
        Kontribusi: {{ contribution(c.id)!.kontribusi }} dari {{ c.bobot }}
      </p>
    </fieldset>

    <div v-if="showTotal && (hasSelection || !readonly)" class="rg-total" aria-live="polite">
      <span>Skor rubrik</span>
      <strong>{{ score.total }}</strong><span class="rg-muted">/100</span>
      <span v-if="!score.complete" class="rg-incomplete">
        ({{ criteria.length - score.breakdown.filter((b) => b.level_id).length }} kriteria belum dipilih)
      </span>
    </div>
  </section>
</template>

<style scoped>
.rubric-grader {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  color: var(--color-neutral-800);
}

.rg-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.rg-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

.rg-muted {
  font-size: 0.75rem;
  color: var(--color-neutral-500);
}

.rg-criterion {
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem 0.625rem;
  margin: 0;
  background: var(--color-surface);
  min-width: 0;
}

.rg-legend {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  padding: 0 0.25rem;
}

.rg-name {
  font-weight: 600;
  font-size: 0.875rem;
}

.rg-weight {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary-700);
  background: var(--color-primary-50);
  border: 1px solid var(--color-primary-200);
  border-radius: var(--radius-pill);
  padding: 0 0.5rem;
}

.rg-desc {
  font-size: 0.8125rem;
  color: var(--color-neutral-600);
  margin: 0.125rem 0 0.5rem;
}

.rg-levels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.375rem;
}

.rg-level {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-sm);
  background: var(--color-neutral-50);
  cursor: pointer;
  transition: border-color var(--dur-fast, 0.15s), background-color var(--dur-fast, 0.15s);
}

.rg-level.readonly {
  cursor: default;
}

.rg-level:not(.readonly):hover {
  border-color: var(--color-primary-300);
}

.rg-level.selected {
  border-color: var(--color-primary-500);
  background: var(--color-primary-50);
  box-shadow: 0 0 0 1px var(--color-primary-500) inset;
}

.rg-level:focus-within {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 1px;
}

.rg-radio {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.rg-level-top {
  display: flex;
  justify-content: space-between;
  gap: 0.375rem;
  font-size: 0.8125rem;
}

.rg-level-label {
  font-weight: 600;
}

.rg-level.selected .rg-level-label {
  color: var(--color-primary-700);
}

.rg-level-poin {
  color: var(--color-neutral-500);
  white-space: nowrap;
}

.rg-level-desc {
  font-size: 0.75rem;
  color: var(--color-neutral-600);
  line-height: 1.4;
}

.rg-note {
  margin-top: 0.375rem;
  font-size: 0.8125rem;
  color: var(--color-neutral-700);
  padding-left: 0.5rem;
  border-left: 3px solid var(--color-primary-300);
}

.rg-contrib {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--color-neutral-500);
}

.rg-total {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
  flex-wrap: wrap;
  font-size: 0.875rem;
}

.rg-total strong {
  font-size: 1.375rem;
  color: var(--color-neutral-900);
}

.rg-incomplete {
  font-size: 0.75rem;
  color: var(--color-warning);
}
</style>
