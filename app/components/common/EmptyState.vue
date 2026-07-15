<script setup lang="ts">
/**
 * EmptyState — Displayed when a list or section has no data.
 *
 * Props:
 * - message: The empty state message (default: "Tidak ada data.")
 * - icon: Optional emoji/icon shown above the message
 */
defineProps<{
  message?: string
  icon?: string
}>()
</script>

<template>
  <div class="empty-state card">
    <span v-if="icon" class="empty-icon">{{ icon }}</span>
    <p>{{ message || 'Tidak ada data.' }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty-state {
  text-align: center;
  padding: 2.5rem 1.5rem;
  color: var(--color-neutral-500);
}

.empty-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 0.75rem;
}

.empty-state p {
  font-size: 0.9375rem;
}
</style>
