<script setup lang="ts">
/**
 * AdminDemoToggle — Runtime demo-mode switch (admin only).
 * Toggles between demo (local data) and production (Supabase) mode
 * without restarting the app.
 */
const ui = useUiStore()
const isDemo = computed(() => ui.isDemoMode)
const toggling = ref(false)

async function handleToggle() {
  toggling.value = true
  try {
    await ui.toggleDemoMode()
  } finally {
    toggling.value = false
  }
}
</script>

<template>
  <div class="demo-toggle">
    <div class="demo-toggle-row">
      <span class="demo-toggle-label">
        <span class="demo-toggle-icon">{{ isDemo ? '🗄️' : '☁️' }}</span>
        <span>{{ isDemo ? 'Demo Mode' : 'Live Mode' }}</span>
      </span>
      <button
        class="demo-toggle-switch"
        :class="{ active: isDemo, toggling }"
        :disabled="toggling"
        @click="handleToggle"
        :aria-label="isDemo ? 'Switch to production mode' : 'Switch to demo mode'"
        :title="isDemo ? 'Menggunakan data demo lokal. Klik untuk beralih ke Supabase.' : 'Menggunakan data Supabase. Klik untuk beralih ke data demo.'"
      >
        <span class="demo-toggle-thumb" />
      </button>
    </div>
    <p class="demo-toggle-hint">
      {{ isDemo ? 'Data berasal dari modul lokal' : 'Data berasal dari Supabase' }}
    </p>
  </div>
</template>

<style scoped>
.demo-toggle {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
}

.demo-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.demo-toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.demo-toggle-icon {
  font-size: 1rem;
}

.demo-toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 12px;
  border: none;
  background: var(--border-color);
  cursor: pointer;
  transition: background 0.25s ease;
  flex-shrink: 0;
}

.demo-toggle-switch.active {
  background: var(--color-primary, #3b82f6);
}

.demo-toggle-switch.toggling {
  opacity: 0.6;
  pointer-events: none;
}

.demo-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  transition: transform 0.25s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.demo-toggle-switch.active .demo-toggle-thumb {
  transform: translateX(20px);
}

.demo-toggle-hint {
  margin: 4px 0 0;
  font-size: 0.7rem;
  color: var(--text-muted);
  opacity: 0.7;
}
</style>
