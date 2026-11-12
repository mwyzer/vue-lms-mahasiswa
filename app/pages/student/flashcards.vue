<script setup lang="ts">
/**
 * Flashcard + spaced repetition (SM-2).
 * Tabs: Review (due today) · Kartu Saya (manual CRUD) · Buat dengan AI (drafts) · Statistik.
 * State: stores/flashcards.ts. Query `?lesson=<id>` opens the AI tab for that lesson.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student'],
})

import { useFlashcardsStore, FLASHCARD_FRONT_MAX, FLASHCARD_BACK_MAX } from '~/stores/flashcards'
import { useCoursesStore } from '~/stores/courses'
import { useNotification } from '~/composables/useNotification'
import { formatInterval, toLocalDateKey } from '~/utils/sm2'

type Tab = 'review' | 'cards' | 'ai' | 'stats'

const route = useRoute()
const store = useFlashcardsStore()
const courses = useCoursesStore()
const notify = useNotification()

const initialLesson = typeof route.query.lesson === 'string' ? route.query.lesson : null
const tab = ref<Tab>(initialLesson ? 'ai' : 'review')
const courseFilter = ref<string>('')
const ready = ref(false)

onMounted(async () => {
  await courses.init()
  await store.init()
  ready.value = true
})

const tabs: Array<{ key: Tab; label: string }> = [
  { key: 'review', label: 'Review' },
  { key: 'cards', label: 'Kartu Saya' },
  { key: 'ai', label: 'Buat dengan AI' },
  { key: 'stats', label: 'Statistik' },
]

const myCourses = computed(() => courses.myCourses)
const courseName = (id: string | null) => {
  if (!id) return 'Tanpa mata kuliah'
  const c = courses.allCourses.find((x) => x.id === id)
  return c ? `${c.kode} — ${c.nama}` : id
}
const lessonsForCourse = (courseId: string) => (courseId ? courses.getLessonsForAi().filter((l) => l.course_id === courseId) : [])

const today = computed(() => toLocalDateKey())
const stats = computed(() => store.stats(today.value))
const dueCount = computed(() => store.dueCards(today.value).filter((c) => !courseFilter.value || c.course_id === courseFilter.value).length)
const filteredCards = computed(() => store.cardsByCourse(courseFilter.value || null))
const maxForecast = computed(() => Math.max(1, ...stats.value.forecast.map((f) => f.count)))

// ── Manual create / edit ──
const form = reactive({ front: '', back: '', course_id: '', lesson_id: '' })
const editingId = ref<string | null>(null)
const formLessons = computed(() => lessonsForCourse(form.course_id))
watch(() => form.course_id, () => { if (!formLessons.value.some((l) => l.id === form.lesson_id)) form.lesson_id = '' })

function resetForm() {
  form.front = ''
  form.back = ''
  form.lesson_id = ''
  editingId.value = null
}

async function submitForm() {
  const payload = { front: form.front, back: form.back, course_id: form.course_id || null, lesson_id: form.lesson_id || null }
  if (editingId.value) {
    if (await store.updateCard(editingId.value, payload)) {
      notify.success('Kartu diperbarui.')
      resetForm()
    } else notify.error(store.error || 'Gagal memperbarui kartu.')
    return
  }
  const id = await store.createCard({ ...payload, source: 'manual' })
  if (id) {
    notify.success('Kartu dibuat dan masuk antrian review hari ini.')
    resetForm()
  } else notify.error(store.error || 'Gagal membuat kartu.')
}

function startEdit(id: string) {
  const c = store.myCards.find((x) => x.id === id)
  if (!c) return
  editingId.value = id
  form.front = c.front
  form.back = c.back
  form.course_id = c.course_id ?? ''
  nextTick(() => { form.lesson_id = c.lesson_id ?? '' })
}

async function remove(id: string) {
  if (!confirm('Hapus kartu ini? Riwayat review-nya ikut terhapus.')) return
  if (await store.deleteCard(id)) notify.success('Kartu dihapus.')
  else notify.error(store.error || 'Gagal menghapus kartu.')
}

function dueLabel(due: string): string {
  if (due < today.value) return 'terlambat'
  if (due === today.value) return 'hari ini'
  return due
}

function onSaved(n: number) {
  if (n > 0) tab.value = 'review'
}
</script>

<template>
  <div class="fc-page">
    <PageHeader title="Flashcard" subtitle="Ulangi materi dengan spaced repetition (SM-2): kartu yang sulit muncul lebih sering, yang mudah makin jarang." />

    <div class="fc-toolbar">
      <div class="fc-tabs" role="tablist" aria-label="Bagian flashcard">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          role="tab"
          class="fc-tab"
          :class="{ active: tab === t.key }"
          :aria-selected="tab === t.key"
          :data-testid="`tab-${t.key}`"
          @click="tab = t.key"
        >
          {{ t.label }}
          <span v-if="t.key === 'review' && dueCount > 0" class="badge badge-primary">{{ dueCount }}</span>
          <span v-if="t.key === 'ai' && store.drafts.length > 0" class="badge badge-warning">{{ store.drafts.length }}</span>
        </button>
      </div>
      <label v-if="tab === 'review' || tab === 'cards'" class="fc-filter">
        Mata kuliah
        <select v-model="courseFilter" class="form-select" data-testid="course-filter">
          <option value="">Semua</option>
          <option v-for="c in myCourses" :key="c.id" :value="c.id">{{ c.kode }} — {{ c.nama }}</option>
        </select>
      </label>
    </div>

    <div v-if="!ready || store.loading" class="card fc-pad" aria-busy="true">Memuat kartu…</div>

    <template v-else>
      <!-- Review -->
      <FlashcardReviewSession v-if="tab === 'review'" :course-id="courseFilter || null" />

      <!-- Kartu Saya -->
      <div v-else-if="tab === 'cards'" class="fc-cards">
        <form class="card fc-form" data-testid="card-form" @submit.prevent="submitForm">
          <h2 class="fc-heading">{{ editingId ? 'Edit kartu' : 'Kartu baru' }}</h2>
          <div class="fc-form-grid">
            <div class="form-group">
              <label class="form-label" for="fc-front">Sisi depan (pertanyaan)</label>
              <textarea id="fc-front" v-model="form.front" class="form-textarea" rows="3" :maxlength="FLASHCARD_FRONT_MAX" required data-testid="card-front" />
            </div>
            <div class="form-group">
              <label class="form-label" for="fc-back">Sisi belakang (jawaban)</label>
              <textarea id="fc-back" v-model="form.back" class="form-textarea" rows="3" :maxlength="FLASHCARD_BACK_MAX" required data-testid="card-back" />
            </div>
            <div class="form-group">
              <label class="form-label" for="fc-course">Mata kuliah (opsional)</label>
              <select id="fc-course" v-model="form.course_id" class="form-select">
                <option value="">Tanpa mata kuliah</option>
                <option v-for="c in myCourses" :key="c.id" :value="c.id">{{ c.kode }} — {{ c.nama }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="fc-lesson">Materi (opsional)</label>
              <select id="fc-lesson" v-model="form.lesson_id" class="form-select" :disabled="formLessons.length === 0">
                <option value="">—</option>
                <option v-for="l in formLessons" :key="l.id" :value="l.id">{{ l.judul }}</option>
              </select>
            </div>
          </div>
          <div class="fc-row">
            <button type="submit" class="btn btn-primary" data-testid="card-submit">{{ editingId ? 'Simpan perubahan' : 'Tambah kartu' }}</button>
            <button v-if="editingId" type="button" class="btn btn-ghost btn-sm" @click="resetForm">Batal</button>
          </div>
        </form>

        <EmptyState v-if="filteredCards.length === 0" icon="🗂️" message="Belum ada kartu. Buat manual di atas atau gunakan “Buat dengan AI”." />
        <ul v-else class="fc-list">
          <li v-for="c in filteredCards" :key="c.id" class="card fc-item" data-testid="card-item">
            <div class="fc-item-main">
              <p class="fc-front">{{ c.front }}</p>
              <p class="fc-back text-sm">{{ c.back }}</p>
              <p class="fc-meta text-xs">
                <span>{{ courseName(c.course_id) }}</span>
                <span :class="{ 'fc-overdue': c.due_date < today }">Jatuh tempo: {{ dueLabel(c.due_date) }}</span>
                <span>Interval: {{ formatInterval(c.interval_days) }}</span>
                <span>EF {{ c.ease_factor.toFixed(2) }}</span>
                <span v-if="c.source === 'ai'" class="badge badge-primary">AI</span>
              </p>
            </div>
            <div class="fc-item-actions">
              <button type="button" class="btn btn-ghost btn-xs" @click="startEdit(c.id)">Edit</button>
              <button type="button" class="btn btn-ghost btn-xs fc-danger" @click="remove(c.id)">Hapus</button>
            </div>
          </li>
        </ul>
      </div>

      <!-- AI -->
      <FlashcardAiGenerator v-else-if="tab === 'ai'" :initial-lesson-id="initialLesson" @saved="onSaved" />

      <!-- Statistik -->
      <div v-else class="fc-stats-wrap" data-testid="stats">
        <div class="fc-stats">
          <StatCard icon="🗂️" :value="stats.total" label="Total kartu" variant="primary" />
          <StatCard icon="⏰" :value="stats.due" label="Jatuh tempo hari ini" variant="warning" />
          <StatCard icon="✅" :value="stats.accuracyToday === null ? '–' : `${stats.accuracyToday}%`" :label="`Akurasi hari ini (${stats.reviewedToday} review)`" variant="success" />
          <StatCard icon="🔥" :value="`${stats.streak} hari`" label="Streak review" variant="accent" />
        </div>
        <div class="card fc-pad">
          <h2 class="fc-heading">Status kartu</h2>
          <dl class="fc-dl">
            <div><dt>Baru</dt><dd>{{ stats.fresh }}</dd></div>
            <div><dt>Sedang dipelajari</dt><dd>{{ stats.learning }}</dd></div>
            <div><dt>Matang (≥ 21 hari)</dt><dd>{{ stats.mature }}</dd></div>
            <div><dt>Rata-rata ease factor</dt><dd>{{ stats.averageEase ?? '–' }}</dd></div>
            <div><dt>Total lupa (lapses)</dt><dd>{{ stats.totalLapses }}</dd></div>
          </dl>
        </div>
        <div class="card fc-pad">
          <h2 class="fc-heading">Perkiraan review 7 hari</h2>
          <ul class="fc-forecast">
            <li v-for="(f, i) in stats.forecast" :key="f.date">
              <span class="fc-fc-label text-xs">{{ i === 0 ? 'Hari ini' : f.date.slice(5) }}</span>
              <span class="fc-fc-bar"><span class="fc-fc-fill" :style="{ width: `${(f.count / maxForecast) * 100}%` }" /></span>
              <span class="fc-fc-count text-sm">{{ f.count }}</span>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.fc-page { display: flex; flex-direction: column; gap: 1.25rem; }
.fc-pad { padding: 1rem 1.25rem; color: var(--color-neutral-800); }
.fc-toolbar { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: space-between; align-items: center; }
.fc-tabs { display: flex; flex-wrap: wrap; gap: 0.25rem; border-bottom: 1px solid var(--color-neutral-200); }
.fc-tab {
  display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 0.9rem;
  background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px;
  color: var(--color-neutral-500); font: inherit; font-size: 0.9rem; cursor: pointer;
}
.fc-tab:hover { color: var(--color-neutral-800); }
.fc-tab.active { color: var(--color-accent); border-bottom-color: var(--color-accent); font-weight: 600; }
.fc-tab:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.fc-filter { display: inline-flex; gap: 0.5rem; align-items: center; font-size: 0.875rem; color: var(--color-neutral-500); }
.fc-filter .form-select { width: auto; }

.fc-heading { font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; color: var(--color-neutral-800); }
.fc-cards { display: flex; flex-direction: column; gap: 1rem; }
.fc-form { padding: 1rem 1.25rem; }
.fc-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0 1rem; }
.fc-row { display: flex; gap: 0.5rem; align-items: center; }

.fc-list { list-style: none; display: flex; flex-direction: column; gap: 0.6rem; }
.fc-item { padding: 0.85rem 1rem; display: flex; justify-content: space-between; gap: 1rem; }
.fc-item-main { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
.fc-front { font-weight: 600; color: var(--color-neutral-800); }
.fc-back { color: var(--color-neutral-500); white-space: pre-wrap; }
.fc-meta { display: flex; flex-wrap: wrap; gap: 0.75rem; color: var(--color-neutral-500); align-items: center; }
.fc-overdue { color: var(--color-error); font-weight: 600; }
.fc-item-actions { display: flex; gap: 0.25rem; align-items: flex-start; }
.fc-danger { color: var(--color-error); }

.fc-stats-wrap { display: flex; flex-direction: column; gap: 1rem; }
.fc-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
.fc-dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; }
.fc-dl dt { font-size: 0.8rem; color: var(--color-neutral-500); }
.fc-dl dd { font-size: 1.25rem; font-weight: 700; font-family: var(--font-label); color: var(--color-neutral-800); }
.fc-forecast { list-style: none; display: flex; flex-direction: column; gap: 0.45rem; }
.fc-forecast li { display: grid; grid-template-columns: 70px 1fr 32px; gap: 0.6rem; align-items: center; }
.fc-fc-label { color: var(--color-neutral-500); font-family: var(--font-label); }
.fc-fc-bar { height: 10px; background: var(--color-neutral-200); border-radius: var(--radius-pill); overflow: hidden; }
.fc-fc-fill { display: block; height: 100%; background: var(--color-accent); border-radius: inherit; }
.fc-fc-count { text-align: right; font-family: var(--font-label); color: var(--color-neutral-800); }
</style>
