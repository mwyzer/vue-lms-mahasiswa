<script setup lang="ts">
/**
 * Global error page — handles 404 and 500 errors.
 */
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const is404 = computed(() => props.error.statusCode === 404)

function handleError() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="error-page">
    <div class="error-card">
      <div class="error-icon">{{ is404 ? '🔍' : '⚠️' }}</div>
      <h1 class="error-code">{{ error.statusCode }}</h1>
      <h2 class="error-title">
        {{ is404 ? 'Halaman Tidak Ditemukan' : 'Terjadi Kesalahan' }}
      </h2>
      <p class="error-desc">
        {{ is404
          ? 'Halaman yang Anda cari tidak tersedia atau telah dipindahkan.'
          : 'Maaf, terjadi kesalahan pada sistem. Silakan coba lagi.'
        }}
      </p>
      <div class="error-actions">
        <button class="btn btn-primary" @click="handleError">
          Kembali ke Beranda
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background-color: var(--color-neutral-50);
}

.error-card {
  text-align: center;
  max-width: 420px;
}

.error-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.error-code {
  font-size: 5rem;
  font-weight: 800;
  color: var(--color-primary-600);
  line-height: 1;
  margin-bottom: 0.5rem;
}

.error-title {
  font-size: 1.5rem;
  margin-bottom: 0.75rem;
}

.error-desc {
  color: var(--color-neutral-500);
  margin-bottom: 2rem;
  line-height: 1.6;
}
</style>
