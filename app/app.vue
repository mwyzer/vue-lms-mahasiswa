<script setup lang="ts">
/**
 * Root app component — LMS Mahasiswa
 *
 * Provides the top-level Nuxt layout wrapper and global
 * toast notification container.
 */
import { useUiStore } from '~/stores/ui'

const ui = useUiStore()
</script>

<template>
  <div id="lms-app">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- Global Toast Container -->
    <Teleport to="body">
      <div
        v-if="ui.hasToasts"
        class="toast-container"
        role="alert"
        aria-live="polite"
      >
        <TransitionGroup name="toast">
          <div
            v-for="toast in ui.activeToasts"
            :key="toast.id"
            class="toast"
            :class="`toast-${toast.type}`"
          >
            <span class="toast-icon">
              {{ toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : toast.type === 'warning' ? '⚠️' : 'ℹ️' }}
            </span>
            <span class="toast-message">{{ toast.message }}</span>
            <button class="toast-close" @click="ui.dismissToast(toast.id)">
              ✕
            </button>
          </div>
        </TransitionGroup>
      </div>
    </Teleport>
  </div>
</template>

<style>
/* Toast container */
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 24rem;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  font-size: 0.875rem;
  font-weight: 500;
  background-color: white;
  border: 1px solid var(--color-neutral-200);
}

.toast-success { border-left: 4px solid var(--color-success); }
.toast-error { border-left: 4px solid var(--color-error); }
.toast-warning { border-left: 4px solid var(--color-warning); }
.toast-info { border-left: 4px solid var(--color-info); }

.toast-icon { font-size: 1.125rem; }
.toast-message { flex: 1; color: var(--color-neutral-800); }

.toast-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--color-neutral-400);
  padding: 0.25rem;
  line-height: 1;
}

.toast-close:hover {
  color: var(--color-neutral-600);
}

/* Toast transition */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>

