<script setup lang="ts">
/**
 * StatCard — Displays a statistic with icon, value, and label.
 *
 * Uses Scholar theme tokens instead of hardcoded colors.
 *
 * Props:
 * - icon: Emoji or text icon to display
 * - value: The main numeric/stat value
 * - label: Description of the stat
 * - variant: Color variant — 'primary' | 'success' | 'warning' | 'info' | 'accent' (default: 'primary')
 * - bgColor: Override background for the icon area (uses variant if omitted)
 * - iconColor: Override icon/text color (uses variant if omitted)
 */
const props = withDefaults(defineProps<{
  icon: string
  value: string | number
  label: string
  variant?: 'primary' | 'success' | 'warning' | 'info' | 'accent'
  bgColor?: string
  iconColor?: string
}>(), {
  variant: 'primary',
})

const variantStyles: Record<string, { bg: string; fg: string }> = {
  primary: { bg: 'var(--color-accent-soft)', fg: 'var(--color-accent-deep)' },
  success: { bg: 'oklch(88% 0.10 145 / 0.3)', fg: 'oklch(38% 0.12 145)' },
  warning: { bg: 'oklch(88% 0.10 85 / 0.3)', fg: 'oklch(45% 0.14 75)' },
  info:    { bg: 'oklch(88% 0.06 240 / 0.3)', fg: 'oklch(38% 0.08 240)' },
  accent:  { bg: 'var(--color-accent-soft)', fg: 'var(--color-accent)' },
}
</script>

<template>
  <div
    class="card stat-card"
    :style="{
      '--stat-bg': bgColor || variantStyles[variant].bg,
      '--stat-fg': iconColor || variantStyles[variant].fg,
    }"
  >
    <div class="stat-icon">
      {{ icon }}
    </div>
    <div class="stat-body">
      <span class="stat-value">{{ value }}</span>
      <span class="stat-label">{{ label }}</span>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
}

.stat-icon {
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
  background-color: var(--stat-bg);
  color: var(--stat-fg);
}

.stat-body {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-neutral-900);
  line-height: 1.2;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--color-neutral-500);
}
</style>
