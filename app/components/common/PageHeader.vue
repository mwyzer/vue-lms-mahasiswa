<script setup lang="ts">
/**
 * PageHeader — Consistent page title and subtitle.
 *
 * Props:
 * - title: Page heading text
 * - subtitle: Optional description below the title
 */
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="page-header">
    <div>
      <h1>{{ title }}</h1>
      <p v-if="subtitle" class="text-muted">{{ subtitle }}</p>
    </div>
    <slot name="actions" />
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.text-muted {
  color: var(--color-neutral-500);
  font-size: 0.875rem;
}
</style>
