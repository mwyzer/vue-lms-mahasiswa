<script setup lang="ts">
/**
 * ThemeToggle — switches between light and dark theme.
 * The choice is saved; until the user picks one, the app follows the OS setting.
 */
import { useUiStore } from '~/stores/ui'

const ui = useUiStore()
const isDark = computed(() => ui.theme === 'dark')
const label = computed(() => (isDark.value ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'))
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-label="label"
    :title="label"
    :aria-pressed="isDark"
    @click="ui.toggleTheme()"
  >
    <span aria-hidden="true">{{ isDark ? '☀️' : '🌙' }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  font-size: 1.0625rem;
  line-height: 1;
  cursor: pointer;
}

.theme-toggle:hover {
  background-color: var(--color-neutral-100);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}
</style>
