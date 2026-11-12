<script setup lang="ts">
/**
 * StreakHeatmap — activity count per day (last N days), 7 columns per row.
 * Intensity uses the primary token at different opacities (theme-aware).
 */
const props = defineProps<{
  days: { day: string; count: number }[]
}>()

function level(count: number): number {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  return 3
}

function label(d: { day: string; count: number }): string {
  const date = new Date(`${d.day}T12:00:00Z`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${date}: ${d.count} aktivitas`
}

const todayKey = computed(() => props.days[props.days.length - 1]?.day)
</script>

<template>
  <div class="heatmap" role="img" :aria-label="`Aktivitas ${days.length} hari terakhir`">
    <span
      v-for="d in days"
      :key="d.day"
      class="heatmap__cell"
      :class="[`lvl-${level(d.count)}`, { today: d.day === todayKey }]"
      :title="label(d)"
    />
  </div>
  <div class="heatmap-legend" aria-hidden="true">
    <span>Sedikit</span>
    <span class="heatmap__cell lvl-0" />
    <span class="heatmap__cell lvl-1" />
    <span class="heatmap__cell lvl-2" />
    <span class="heatmap__cell lvl-3" />
    <span>Banyak</span>
  </div>
</template>

<style scoped>
.heatmap {
  display: grid;
  grid-template-columns: repeat(14, minmax(0, 1fr));
  gap: 4px;
  max-width: 26rem;
}

.heatmap__cell {
  display: block;
  aspect-ratio: 1;
  min-width: 10px;
  border-radius: 3px;
  background: var(--color-neutral-100);
  border: 1px solid var(--color-neutral-200);
}

.heatmap__cell.lvl-1 { background: color-mix(in srgb, var(--color-primary-500) 30%, var(--color-surface)); border-color: transparent; }
.heatmap__cell.lvl-2 { background: color-mix(in srgb, var(--color-primary-500) 60%, var(--color-surface)); border-color: transparent; }
.heatmap__cell.lvl-3 { background: var(--color-primary-600); border-color: transparent; }

.heatmap__cell.today {
  outline: 2px solid var(--color-primary-400);
  outline-offset: 1px;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-neutral-500);
}

.heatmap-legend .heatmap__cell {
  width: 10px;
  height: 10px;
  min-width: 10px;
}
</style>
