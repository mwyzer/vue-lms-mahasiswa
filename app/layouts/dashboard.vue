<script setup lang="ts">
/**
 * Dashboard layout — authenticated pages for Student role.
 * Includes sidebar navigation, top bar, and main content area.
 */
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const route = useRoute()

const navigation = computed(() => [
  { label: 'Dashboard', icon: '📊', to: '/dashboard' },
  { label: 'Mata Kuliah', icon: '📖', to: '/courses' },
  { label: 'Tugas', icon: '📝', to: '/assignments' },
  { label: 'Nilai', icon: '🏆', to: '/student/grades' },
  { label: 'Kuis & Ujian', icon: '✍️', to: '/quiz' },
  { label: 'Presensi', icon: '✅', to: '/student/attendance' },
  { label: 'Kalender', icon: '📅', to: '/calendar' },
  { label: 'AI Tutor', icon: '🤖', to: '/ai/chat' },
  { label: 'Python', icon: '🐍', to: '/playground' },
  { label: 'Profil', icon: '👤', to: '/profile' }
])

const sidebarOpen = ref(false)

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function closeSidebar() {
  sidebarOpen.value = false
}
</script>

<template>
  <div class="dashboard-layout">
    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen"
      class="sidebar-overlay"
      @click="closeSidebar"
    />

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <NuxtLink to="/dashboard" class="sidebar-logo" @click="closeSidebar">
          <span class="logo-icon">📚</span>
          <span class="logo-text">LMS Mahasiswa</span>
        </NuxtLink>
      </div>

      <nav class="sidebar-nav">
        <NuxtLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: route.path.startsWith(item.to) }"
          @click="closeSidebar"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info">
          <span class="user-avatar">
            <img v-if="auth.user?.avatar_url" :src="auth.user.avatar_url" :alt="auth.user.nama" class="avatar-img" />
            <span v-else>{{ auth.user?.nama?.charAt(0) || '?' }}</span>
          </span>
          <div class="user-details">
            <span class="user-name">{{ auth.user?.nama || 'Pengguna' }}</span>
            <span class="user-role">Mahasiswa</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm logout-btn" @click="auth.logout">
          Keluar
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="main-area">
      <!-- Top bar -->
      <header class="topbar">
        <button class="btn btn-ghost btn-sm hamburger" @click="toggleSidebar">
          <span class="hamburger-icon">☰</span>
        </button>

        <div class="topbar-right">
          <span class="text-sm text-muted">
            {{ auth.user?.nama }}
          </span>
        </div>
      </header>

      <!-- Page content -->
      <main class="content">
        <slot />
      </main>
    </div>

    <!-- Bottom Navigation (Mobile) -->
    <nav class="bottom-nav">
      <NuxtLink
        v-for="item in navigation"
        :key="item.to"
        :to="item.to"
        class="bottom-nav-item"
        :class="{ active: route.path.startsWith(item.to) }"
      >
        <span class="bottom-nav-icon">{{ item.icon }}</span>
        <span class="bottom-nav-label">{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </div>
  <UpdatePrompt />
</template>

<style scoped>
.dashboard-layout {
  display: flex;
  min-height: 100vh;
}

/* Sidebar */
.sidebar {
  width: var(--sidebar-width);
  background-color: white;
  border-right: 1px solid var(--color-neutral-200);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  z-index: 100;
  transition: transform 0.3s ease;
}

.sidebar-overlay {
  display: none;
}

.sidebar-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-neutral-200);
  height: var(--header-height);
  display: flex;
  align-items: center;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  font-weight: 700;
  font-size: 1.125rem;
  color: var(--color-neutral-900);
}

.sidebar-nav {
  flex: 1;
  padding: 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-md);
  color: var(--color-neutral-600);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.15s ease;
}

.nav-item:hover {
  background-color: var(--color-neutral-100);
  color: var(--color-neutral-800);
  text-decoration: none;
}

.nav-item.active {
  background-color: var(--color-primary-50);
  color: var(--color-primary-700);
  font-weight: 600;
}

.nav-icon {
  font-size: 1.25rem;
  width: 1.5rem;
  text-align: center;
}

.sidebar-footer {
  padding: 1rem 0.75rem;
  border-top: 1px solid var(--color-neutral-200);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.user-avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background-color: var(--color-primary-100);
  color: var(--color-primary-700);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.user-details {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--color-neutral-800);
}

.user-role {
  font-size: 0.75rem;
  color: var(--color-neutral-500);
}

.logout-btn {
  width: 100%;
}

/* Main Area */
.main-area {
  flex: 1;
  margin-left: var(--sidebar-width);
  display: flex;
  flex-direction: column;
}

.topbar {
  height: var(--header-height);
  background-color: white;
  border-bottom: 1px solid var(--color-neutral-200);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  position: sticky;
  top: 0;
  z-index: 50;
}

.hamburger {
  display: none;
}

.text-muted {
  color: var(--color-neutral-500);
}

.content {
  flex: 1;
  padding: 1.5rem;
}

/* Responsive */
@media (max-width: 767px) {
  .sidebar {
    transform: translateX(-100%);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.4);
    z-index: 99;
  }

  .main-area {
    margin-left: 0;
  }

  .hamburger {
    display: inline-flex;
  }

  .hamburger-icon {
    font-size: 1.5rem;
  }
}

/* ── Bottom Navigation (Mobile) ── */
.bottom-nav {
  display: none;
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  padding: 0.375rem 0.375rem;
  text-decoration: none;
  color: var(--color-neutral-500);
  font-size: 0.625rem;
  font-weight: 500;
  transition: color 0.15s ease;
  flex: 1;
  min-width: 0;
}

.bottom-nav-item:hover {
  color: var(--color-neutral-800);
  text-decoration: none;
}

.bottom-nav-item.active {
  color: var(--color-primary-600);
}

.bottom-nav-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.bottom-nav-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  font-size: 0.5625rem;
}

@media (max-width: 767px) {
  .bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-card, #ffffff);
    border-top: 1px solid var(--border-color, #e2e8f0);
    z-index: 100;
    justify-content: space-around;
    align-items: stretch;
    padding: 0.375rem 0;
    padding-bottom: max(0.375rem, env(safe-area-inset-bottom, 0.375rem));
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
  }

  .sidebar-nav {
    display: none;
  }

  .content {
    padding-bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px));
  }
}
</style>
