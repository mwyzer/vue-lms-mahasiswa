<script setup lang="ts">
/**
 * ForumThreadList — list of discussion threads for one course, with a
 * "new thread" form. Shared by the student and instructor forum pages.
 */
import { useForumStore, THREAD_TITLE_MAX, POST_BODY_MAX } from '~/stores/forum'
import { useCoursesStore } from '~/stores/courses'
import { useAuthStore } from '~/stores/auth'

const props = defineProps<{
  courseId: string
  /** Route prefix for thread links, e.g. `/courses/c1/forum`. */
  basePath: string
  /** Route of the course page to go back to. */
  backTo: string
}>()

const forum = useForumStore()
const coursesStore = useCoursesStore()
const auth = useAuthStore()
const notification = useNotification()

const ready = ref(false)
const search = ref('')
const showForm = ref(false)
const formJudul = ref('')
const formKonten = ref('')
const formLessonId = ref('')
const saving = ref(false)

onMounted(async () => {
  await auth.init()
  await coursesStore.init()
  coursesStore.setCurrentCourse(props.courseId)
  await forum.init()
  ready.value = true
})

const course = computed(() => coursesStore.allCourses.find((c) => c.id === props.courseId) || null)
const lessons = computed(() => (coursesStore.currentCourse?.id === props.courseId ? coursesStore.lessons : []))

const threads = computed(() => {
  const q = search.value.trim().toLowerCase()
  const all = forum.threadsByCourse(props.courseId)
  if (!q) return all
  return all.filter((t) => t.judul.toLowerCase().includes(q) || t.konten.toLowerCase().includes(q))
})

function lessonTitle(lessonId?: string | null): string {
  if (!lessonId) return ''
  return lessons.value.find((l) => l.id === lessonId)?.judul || ''
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function roleLabel(role: string | null): string {
  if (role === 'instructor') return 'Instruktur'
  if (role === 'admin') return 'Admin'
  return ''
}

function openForm() {
  formJudul.value = ''
  formKonten.value = ''
  formLessonId.value = ''
  showForm.value = true
}

async function submitThread() {
  saving.value = true
  const id = await forum.createThread(props.courseId, formJudul.value, formKonten.value, formLessonId.value || null)
  saving.value = false

  if (!id) {
    notification.error(forum.error || 'Gagal membuat diskusi.')
    return
  }
  showForm.value = false
  notification.success('Diskusi berhasil dibuat.')
  await navigateTo(`${props.basePath}/${id}`)
}
</script>

<template>
  <div class="forum-page">
    <NuxtLink :to="backTo" class="btn btn-ghost btn-sm back-link">← Kembali ke Mata Kuliah</NuxtLink>

    <div class="forum-header">
      <div>
        <h1>Forum Diskusi</h1>
        <p v-if="course" class="forum-sub">{{ course.kode }} — {{ course.nama }}</p>
      </div>
      <button v-if="!showForm" class="btn btn-primary btn-sm" @click="openForm">+ Diskusi Baru</button>
    </div>

    <!-- New thread form -->
    <form v-if="showForm" class="card forum-form" @submit.prevent="submitThread">
      <h2>Diskusi Baru</h2>
      <div class="form-group">
        <label class="form-label" for="forum-judul">Judul</label>
        <input
          id="forum-judul"
          v-model="formJudul"
          class="form-input"
          type="text"
          :maxlength="THREAD_TITLE_MAX"
          placeholder="Tulis pertanyaan atau topik secara singkat"
          required
        />
      </div>
      <div v-if="lessons.length > 0" class="form-group">
        <label class="form-label" for="forum-lesson">Terkait materi (opsional)</label>
        <select id="forum-lesson" v-model="formLessonId" class="form-select">
          <option value="">Umum — tidak terkait materi tertentu</option>
          <option v-for="l in lessons" :key="l.id" :value="l.id">{{ l.urutan }}. {{ l.judul }}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="forum-konten">Isi</label>
        <textarea
          id="forum-konten"
          v-model="formKonten"
          class="form-textarea"
          rows="5"
          :maxlength="POST_BODY_MAX"
          placeholder="Jelaskan pertanyaan Anda, apa yang sudah dicoba, dan bagian mana yang membingungkan."
          required
        />
        <span class="char-count">{{ formKonten.length }} / {{ POST_BODY_MAX }}</span>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost btn-sm" @click="showForm = false">Batal</button>
        <button
          type="submit"
          class="btn btn-primary btn-sm"
          :disabled="saving || !formJudul.trim() || !formKonten.trim()"
        >
          {{ saving ? 'Mengirim...' : 'Kirim Diskusi' }}
        </button>
      </div>
    </form>

    <!-- Search -->
    <div v-if="ready && forum.threadCount(courseId) > 0" class="forum-search">
      <label class="sr-only" for="forum-search">Cari diskusi</label>
      <input id="forum-search" v-model="search" class="form-input" type="search" placeholder="Cari diskusi..." />
    </div>

    <p v-if="!ready" class="forum-muted">Memuat diskusi...</p>

    <div v-else-if="forum.threadCount(courseId) === 0" class="card forum-empty">
      <div class="forum-empty-icon" aria-hidden="true">💬</div>
      <p>Belum ada diskusi di mata kuliah ini.</p>
      <p class="forum-muted">Mulai dengan pertanyaan pertama — instruktur dan teman sekelas bisa membalas.</p>
    </div>

    <p v-else-if="threads.length === 0" class="forum-muted">Tidak ada diskusi yang cocok dengan "{{ search }}".</p>

    <ul v-else class="thread-list">
      <li v-for="t in threads" :key="t.id">
        <NuxtLink :to="`${basePath}/${t.id}`" class="card thread-card">
          <div class="thread-main">
            <div class="thread-badges">
              <span v-if="t.is_pinned" class="badge badge-primary">📌 Disematkan</span>
              <span v-if="t.is_locked" class="badge badge-neutral">🔒 Dikunci</span>
              <span v-if="t.has_answer" class="badge badge-success">✓ Terjawab</span>
              <span v-if="lessonTitle(t.lesson_id)" class="badge badge-neutral">📖 {{ lessonTitle(t.lesson_id) }}</span>
            </div>
            <h3 class="thread-title">{{ t.judul }}</h3>
            <p class="thread-excerpt">{{ t.konten }}</p>
            <p class="thread-meta">
              {{ t.author_name }}
              <span v-if="roleLabel(t.author_role)" class="role-tag">{{ roleLabel(t.author_role) }}</span>
              · {{ formatDate(t.last_activity) }}
            </p>
          </div>
          <div class="thread-count" :aria-label="`${t.reply_count} balasan`">
            <strong>{{ t.reply_count }}</strong>
            <span>balasan</span>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.forum-page {
  max-width: 56rem;
}

.back-link {
  margin-bottom: 0.75rem;
}

.forum-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.forum-header h1 {
  margin: 0;
}

.forum-sub,
.forum-muted {
  color: var(--color-neutral-500);
  font-size: 0.875rem;
  margin: 0.25rem 0 0;
}

.forum-form {
  margin-bottom: 1.25rem;
}

.forum-form h2 {
  margin: 0 0 1rem;
  font-size: 1.125rem;
}

.char-count {
  display: block;
  margin-top: 0.25rem;
  text-align: right;
  font-size: 0.75rem;
  color: var(--color-neutral-500);
}

.forum-search {
  margin-bottom: 1rem;
}

.forum-empty {
  text-align: center;
  padding: 2.5rem 1rem;
}

.forum-empty-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.thread-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.thread-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  text-decoration: none;
  color: inherit;
}

.thread-card:hover .thread-title {
  color: var(--color-primary-600);
}

.thread-main {
  flex: 1;
  min-width: 0;
}

.thread-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.thread-badges:not(:empty) {
  margin-bottom: 0.375rem;
}

.thread-title {
  margin: 0;
  font-size: 1rem;
  color: var(--color-neutral-900);
  overflow-wrap: anywhere;
}

.thread-excerpt {
  margin: 0.25rem 0 0.375rem;
  font-size: 0.875rem;
  color: var(--color-neutral-600);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.thread-meta {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-neutral-500);
}

.role-tag {
  margin-left: 0.25rem;
  padding: 0.0625rem 0.375rem;
  border-radius: 9999px;
  background-color: var(--color-primary-100);
  color: var(--color-primary-700);
  font-weight: 600;
}

.thread-count {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 3.5rem;
  font-size: 0.75rem;
  color: var(--color-neutral-500);
}

.thread-count strong {
  font-size: 1.25rem;
  color: var(--color-neutral-800);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 640px) {
  .forum-header {
    flex-direction: column;
  }

  .thread-count {
    min-width: 2.75rem;
  }
}
</style>
