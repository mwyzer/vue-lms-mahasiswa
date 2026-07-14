<script setup lang="ts">
/**
 * Admin layout — authenticated pages for Admin role.
 * Provides navigation to system-wide management across students, instructors, courses.
 */
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const route = useRoute()

const navigation = computed(() => [
  { label: 'Dashboard', icon: '📊', to: '/admin/dashboard' },
  { label: 'Mata Kuliah', icon: '📖', to: '/admin/courses' },
  { label: 'Tugas', icon: '📝', to: '/admin/assignments' },
  { label: 'Mahasiswa', icon: '👥', to: '/admin/students' },
  { label: 'Instruktur', icon: '👨‍🏫', to: '/admin/instructors' },
  { label: 'Profil', icon: '👤', to: '/admin/profile' },
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
  <div class="admin-layout">
    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen"
      class="sidebar-overlay"
      @click="closeSidebar"
    />

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <NuxtLink to="/admin/dashboard" class="sidebar-logo" @click="closeSidebar">
          <span class="logo-icon">📚</span>
          <span class="logo-text">LMS — Admin</span>
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
          <span class="user-avatar">{{ auth.user?.nama?.charAt(0) || '?' }}</span>
          <div class="user-details">
            <span class="user-name">{{ auth.user?.nama || 'Admin' }}</span>
            <span class="user-role">Administrator</span>
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
          <span class="badge badge-danger">Administrator</span>
          <span class="text-sm text-muted">{{ auth.user?.nama }}</span>
        </div>
      </header>

      <!-- Page content -->
      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background-color: var(--bg-body, #f8fafc);
  color: var(--text-primary, #1e293b);
}

/* Shared sidebar styles use the same class names as dashboard/instructor layouts */
.sidebar-overlay {
  display: none;
}

@media (max-width: 768px) {
  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 40;
  }
}

.sidebar {
  width: 260px;
  min-height: 100vh;
  background: var(--bg-card, #ffffff);
  border-right: 1px solid var(--border-color, #e2e8f0);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 50;
  transition: transform 0.3s ease;
}

@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
  }
  .sidebar.open {
    transform: translateX(0);
  }
}

.sidebar-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  text-decoration: none;
  color: inherit;
}

.logo-icon {
  font-size: 1.5rem;
}

.logo-text {
  font-weight: 700;
  font-size: 1.125rem;
  color: var(--text-primary, #1e293b);
}

.sidebar-nav {
  flex: 1;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  text-decoration: none;
  color: var(--text-secondary, #64748b);
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.nav-item:hover {
  background: var(--bg-hover, #f1f5f9);
  color: var(--text-primary, #1e293b);
}

.nav-item.active {
  background: var(--color-primary-bg, #eff6ff);
  color: var(--color-primary, #2563eb);
  font-weight: 600;
}

.nav-icon {
  font-size: 1.125rem;
  width: 1.5rem;
  text-align: center;
}

.sidebar-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border-color, #e2e8f0);
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
  background: var(--color-primary-bg, #eff6ff);
  color: var(--color-primary, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
}

.user-details {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.user-role {
  font-size: 0.75rem;
  color: var(--text-muted, #94a3b8);
}

.logout-btn {
  width: 100%;
  justify-content: center;
}

/* Main content area */
.main-area {
  flex: 1;
  margin-left: 260px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

@media (max-width: 768px) {
  .main-area {
    margin-left: 0;
  }
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: var(--bg-card, #ffffff);
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  position: sticky;
  top: 0;
  z-index: 30;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.hamburger {
  display: none;
}

@media (max-width: 768px) {
  .hamburger {
    display: inline-flex;
  }
}

.hamburger-icon {
  font-size: 1.25rem;
}

.content {
  flex: 1;
  padding: 1.5rem;
}

@media (max-width: 768px) {
  .content {
    padding: 1rem;
  }
}

/* Badge for admin */
.badge.badge-danger {
  background-color: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}
</style>
