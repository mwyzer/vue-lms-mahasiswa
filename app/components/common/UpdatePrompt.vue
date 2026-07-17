<template>
  <Teleport to="body">
    <Transition name="update-prompt">
      <div
        v-if="show"
        class="update-prompt-overlay"
        role="alert"
        aria-live="polite"
      >
        <div class="update-prompt-card">
          <div class="update-prompt-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23,4 23,10 17,10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </div>
          <div class="update-prompt-content">
            <p class="update-prompt-title">Pembaruan Tersedia</p>
            <p class="update-prompt-text">Versi baru aplikasi sudah siap. Muat ulang untuk mendapatkan fitur terbaru.</p>
          </div>
          <div class="update-prompt-actions">
            <button class="update-prompt-btn update-prompt-btn-secondary" @click="dismiss">
              Nanti
            </button>
            <button class="update-prompt-btn update-prompt-btn-primary" @click="refresh">
              Muat Ulang
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const show = ref(false)

function dismiss() {
  show.value = false
}

function refresh() {
  show.value = false
  if (window.__swUpdate) {
    window.__swUpdate(true)
  } else {
    window.location.reload()
  }
}

onMounted(() => {
  window.addEventListener('sw:update', handleSWUpdate)
})

onUnmounted(() => {
  window.removeEventListener('sw:update', handleSWUpdate)
})

function handleSWUpdate() {
  show.value = true
}
</script>

<style scoped>
.update-prompt-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  animation: fadeIn 0.2s ease-out;
}

.update-prompt-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  max-width: 480px;
  width: 100%;
  padding: 1rem 1.25rem;
  background: #fff;
  border-radius: var(--radius-lg, 0.75rem);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1);
  animation: slideUp 0.3s ease-out;
}

.update-prompt-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-primary-100, #dbeafe);
  color: var(--color-primary-600, #2563eb);
}

.update-prompt-content {
  flex: 1;
  min-width: 0;
}

.update-prompt-title {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--color-neutral-900, #0f172a);
  margin-bottom: 0.125rem;
}

.update-prompt-text {
  font-size: 0.8125rem;
  color: var(--color-neutral-500, #64748b);
  line-height: 1.4;
}

.update-prompt-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  align-items: center;
  padding-top: 0.25rem;
}

.update-prompt-btn {
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-sm, 0.375rem);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}

.update-prompt-btn-secondary {
  background: transparent;
  color: var(--color-neutral-600, #475569);
  border-color: var(--color-neutral-200, #e2e8f0);
}

.update-prompt-btn-secondary:hover {
  background: var(--color-neutral-100, #f1f5f9);
}

.update-prompt-btn-primary {
  background: var(--color-primary-600, #2563eb);
  color: #fff;
}

.update-prompt-btn-primary:hover {
  background: var(--color-primary-700, #1d4ed8);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style>
