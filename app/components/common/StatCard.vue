<script setup lang="ts">
/**
 * StatCard — Displays a statistic with icon, value, and label.
 *
 * Props:
 * - icon: Emoji or text icon to display
 * - value: The main numeric/stat value
 * - label: Description of the stat
 * - bgColor: Background color for the icon area (default: #dbeafe)
 * - iconColor: Icon/text color (default: #1d4ed8)
 */
defineProps<{
  icon: string
  value: string | number
  label: string
  bgColor?: string
  iconColor?: string
}>()
</script>

<template>
  <div class="card stat-card">
    <div
      class="stat-icon"
      :style="{
        backgroundColor: bgColor || '#dbeafe',
        color: iconColor || '#1d4ed8'
      }"
    >
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
