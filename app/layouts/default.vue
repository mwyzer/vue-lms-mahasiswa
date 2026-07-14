<script setup lang="ts">
/**
 * Default layout — used for public pages (Landing, Login, etc.)
 * Minimal layout without sidebar/auth navigation.
 */
</script>

<template>
  <div class="layout-default">
    <header class="layout-header">
      <div class="container flex items-center justify-between">
        <NuxtLink to="/" class="logo">
          <span class="logo-icon">📚</span>
          <span class="logo-text">LMS Mahasiswa</span>
        </NuxtLink>

        <nav class="nav-links">
          <NuxtLink to="/login" class="btn btn-primary btn-sm">Masuk</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="layout-main">
      <slot />
    </main>

    <footer class="layout-footer">
      <div class="container text-center">
        <p class="text-sm">&copy; {{ new Date().getFullYear() }} LMS Mahasiswa. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.layout-default {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.layout-header {
  height: var(--header-height);
  background-color: white;
  border-bottom: 1px solid var(--color-neutral-200);
  position: sticky;
  top: 0;
  z-index: 50;
}

.layout-header .container {
  height: 100%;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: var(--color-neutral-900);
  font-weight: 700;
  font-size: 1.125rem;
}

.logo:hover {
  text-decoration: none;
  color: var(--color-primary-600);
}

.logo-icon {
  font-size: 1.5rem;
}

.layout-main {
  flex: 1;
}

.layout-footer {
  padding: 1.5rem 0;
  border-top: 1px solid var(--color-neutral-200);
  background-color: white;
  color: var(--color-neutral-500);
}
</style>
