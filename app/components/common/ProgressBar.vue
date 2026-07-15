<script setup lang="ts">
/**
 * ProgressBar — A labeled progress bar with percentage.
 *
 * Props:
 * - value: Progress percentage (0-100)
 * - label: Left-side label text
 * - showPercent: Whether to show percentage on the right (default: true)
 * - height: Bar height in px (default: 8)
 */
const props = withDefaults(defineProps<{
  value: number
  label?: string
  showPercent?: boolean
  height?: number
}>(), {
  showPercent: true,
  height: 8,
})
</script>

<template>
  <div class="progress-wrapper">
    <div class="progress-header">
      <span v-if="label" class="text-sm">{{ label }}</span>
      <span v-if="showPercent !== false" class="text-sm font-bold">{{ value }}%</span>
    </div>
    <div
      class="progress-bar"
      :style="{ height: height + 'px' }"
    >
      <div
        class="progress-fill"
        :style="{ width: Math.min(100, Math.max(0, value)) + '%' }"
      />
    </div>
  </div>
</template>

<style scoped>
.progress-wrapper {
  width: 100%;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.375rem;
}

.progress-bar {
  width: 100%;
  border-radius: 9999px;
  background-color: var(--color-neutral-200);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 9999px;
  background: linear-gradient(90deg, var(--color-primary-500), var(--color-primary-400));
  transition: width 0.3s ease;
}
</style>
