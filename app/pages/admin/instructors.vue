<script setup lang="ts">
/**
 * Admin Instructors List — Shows all instructors.
 */
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin']
})

const auth = useAuthStore()

const instructors = computed(() => auth.instructorList)

onMounted(() => {
  auth.init()
})
</script>

<template>
  <div class="instructors-page">
    <div class="page-header">
      <div>
        <h1>Instruktur</h1>
        <p class="text-muted">Daftar seluruh instruktur ({{ instructors.length }}).</p>
      </div>
    </div>

    <div v-if="instructors.length === 0" class="empty-state card">
      <p>Belum ada instruktur terdaftar.</p>
    </div>

    <div v-else class="instructor-grid">
      <div
        v-for="inst in instructors"
        :key="inst.id"
        class="card instructor-card"
      >
        <div class="instructor-avatar">{{ inst.nama.charAt(0) }}</div>
        <div class="instructor-info">
          <span class="instructor-name">{{ inst.nama }}</span>
          <span class="instructor-email">{{ inst.email || '—' }}</span>
          <span class="instructor-id">ID: {{ inst.id }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.instructors-page {
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}

.text-muted {
  color: var(--text-muted, #94a3b8);
  font-size: 0.875rem;
  margin: 0;
}

.instructor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.instructor-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
}

.instructor-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: #dcfce7;
  color: #15803d;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.instructor-info {
  display: flex;
  flex-direction: column;
}

.instructor-name {
  font-size: 0.9375rem;
  font-weight: 600;
}

.instructor-email {
  font-size: 0.8125rem;
  color: var(--text-muted, #94a3b8);
  margin-top: 0.125rem;
}

.instructor-id {
  font-size: 0.6875rem;
  color: var(--text-muted, #94a3b8);
  margin-top: 0.125rem;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--text-muted, #94a3b8);
}
</style>
