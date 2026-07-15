<script setup lang="ts">
/**
 * SessionBadge — Displays a badge for class session time.
 *
 * Props:
 * - session: 'morning' | 'evening'
 */
defineProps<{
  session: 'morning' | 'evening'
}>()
</script>

<template>
  <span
    class="badge"
    :class="session === 'morning' ? 'badge-primary' : 'badge-warning'"
  >
    {{ session === 'morning' ? 'Pagi' : 'Malam' }}
  </span>
</template>
