<script setup lang="ts">
/**
 * AI Chat page — Full-page AI Teaching Assistant interface.
 *
 * Instructors also get "Indeks materi untuk AI": (re)builds the pgvector index
 * (`lesson_chunks`) of their courses via POST /api/ai/index-lessons. Without a
 * service role key (e.g. demo mode) the server answers 503 and the tutor keeps
 * reading the material directly, which is what the message says.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth'],
})

const auth = useAuthStore()
const coursesStore = useCoursesStore()

const indexing = ref(false)
const indexMessage = ref<{ kind: 'success' | 'info' | 'error'; text: string } | null>(null)

async function indexLessons() {
  if (indexing.value) return
  if (!coursesStore.initialized) await coursesStore.init()
  const lessons = coursesStore.getLessonsForAi()
  const byCourse = new Map<string, string[]>()
  for (const l of lessons) {
    if (!byCourse.has(l.course_id)) byCourse.set(l.course_id, [])
    byCourse.get(l.course_id)!.push(l.id)
  }
  if (byCourse.size === 0) {
    indexMessage.value = { kind: 'info', text: 'Belum ada materi berisi teks untuk diindeks.' }
    return
  }

  indexing.value = true
  indexMessage.value = null
  let embedded = 0
  let unchanged = 0
  const warnings: string[] = []
  try {
    for (const [courseId, ids] of byCourse) {
      const res = await fetch('/api/ai/index-lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId, lessons: ids.map((id) => ({ id })) }),
      })
      const data = await res.json().catch(() => null)
      if (res.status === 503) {
        indexMessage.value = {
          kind: 'info',
          text: 'Indeks pgvector belum aktif di server ini (butuh SUPABASE_SERVICE_ROLE_KEY). AI tutor tetap menjawab dari materi secara langsung.',
        }
        return
      }
      if (!res.ok) throw new Error(data?.statusMessage || `HTTP ${res.status}`)
      embedded += Number(data?.embedded ?? 0)
      unchanged += Number(data?.unchanged ?? 0)
      if (data?.warning) warnings.push(String(data.warning))
    }
    indexMessage.value = {
      kind: warnings.length ? 'info' : 'success',
      text: `Indeks diperbarui untuk ${byCourse.size} mata kuliah: ${embedded} potongan baru/berubah, ${unchanged} tidak berubah.${warnings.length ? ' ' + warnings[0] : ''}`,
    }
  } catch (err) {
    indexMessage.value = { kind: 'error', text: `Gagal mengindeks materi: ${(err as Error).message}` }
  } finally {
    indexing.value = false
  }
}
</script>

<template>
  <div class="ai-page">
    <PageHeader
      title="AI Teaching Assistant"
      subtitle="Tanyakan tentang materi kuliah, tugas, atau fitur LMS"
    />

    <div v-if="auth.isInstructor" class="index-panel" data-testid="ai-index-panel">
      <div class="index-panel-text">
        <strong>Indeks materi untuk AI</strong>
        <span>Perbarui indeks pencarian setelah menambah atau mengubah materi.</span>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" :disabled="indexing" @click="indexLessons">
        {{ indexing ? 'Mengindeks…' : 'Indeks materi untuk AI' }}
      </button>
      <p v-if="indexMessage" class="index-message" :class="`index-message--${indexMessage.kind}`" role="status">
        {{ indexMessage.text }}
      </p>
    </div>

    <div class="ai-chat-container">
      <AiChat />
    </div>
  </div>
</template>

<style scoped>
.ai-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ai-chat-container {
  flex: 1;
  min-height: 500px;
  display: flex;
  flex-direction: column;
}

.index-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  margin-bottom: 0.75rem;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  font-size: 0.85rem;
}

.index-panel-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 12rem;
  color: var(--color-neutral-600);
}

.index-panel-text strong {
  color: var(--color-neutral-800);
}

.index-message {
  flex-basis: 100%;
  margin: 0;
  font-size: 0.8rem;
}

.index-message--success { color: var(--color-success); }
.index-message--info { color: var(--color-neutral-600); }
.index-message--error { color: var(--color-error); }
</style>
