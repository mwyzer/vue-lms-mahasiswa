<script setup lang="ts">
/**
 * FlashcardAiGenerator — "Buat dengan AI" from a lesson.
 * POST /api/ai/generate-flashcards → editable DRAFTS (status 'draft', not
 * saved) → "Simpan N kartu" saves only the selected drafts.
 */
import { useFlashcardsStore } from '~/stores/flashcards'
import { useCoursesStore } from '~/stores/courses'
import { useNotification } from '~/composables/useNotification'

const props = defineProps<{ initialLessonId?: string | null }>()
const emit = defineEmits<{ saved: [count: number] }>()

const store = useFlashcardsStore()
const courses = useCoursesStore()
const notify = useNotification()

const lessons = ref<ReturnType<typeof courses.getLessonsForAi>>([])
const lessonId = ref<string>('')
const count = ref(8)
const lastSource = ref<'ai' | 'demo' | null>(null)
const saving = ref(false)

onMounted(() => {
  lessons.value = courses.getLessonsForAi()
  const wanted = props.initialLessonId && lessons.value.find((l) => l.id === props.initialLessonId)
  lessonId.value = wanted ? wanted.id : lessons.value[0]?.id ?? ''
})

const lesson = computed(() => lessons.value.find((l) => l.id === lessonId.value) ?? null)

async function generate(fresh = false) {
  if (!lesson.value) return
  const res = await store.generateDrafts(lesson.value, { count: count.value, fresh })
  lastSource.value = res.source
  if (res.count === 0 && store.error) notify.error(store.error)
}

async function save() {
  saving.value = true
  const n = await store.saveDrafts()
  saving.value = false
  if (n < 0) {
    notify.error(store.error || 'Gagal menyimpan kartu.')
    return
  }
  notify.success(n > 0 ? `${n} kartu disimpan dan siap direview hari ini.` : 'Semua kartu terpilih sudah ada di koleksimu.')
  emit('saved', n)
}
</script>

<template>
  <div class="fag">
    <div class="card fag-form">
      <div v-if="lessons.length === 0" class="text-muted">Belum ada materi berisi teks di mata kuliahmu.</div>
      <template v-else>
        <div class="form-group">
          <label class="form-label" for="fag-lesson">Materi</label>
          <select id="fag-lesson" v-model="lessonId" class="form-select" data-testid="ai-lesson">
            <option v-for="l in lessons" :key="l.id" :value="l.id">{{ l.course_kode }} — {{ l.judul }}</option>
          </select>
        </div>
        <div class="form-group fag-count">
          <label class="form-label" for="fag-count">Jumlah kartu</label>
          <input id="fag-count" v-model.number="count" type="number" min="1" max="20" class="form-input" />
        </div>
        <div class="fag-actions">
          <button type="button" class="btn btn-primary" :disabled="!lesson || store.generating" data-testid="ai-generate" @click="generate(false)">
            {{ store.generating ? 'Membuat…' : '✨ Buat dengan AI' }}
          </button>
          <button v-if="store.drafts.length" type="button" class="btn btn-ghost btn-sm" :disabled="store.generating" @click="generate(true)">Buat ulang</button>
        </div>
      </template>
    </div>

    <section v-if="store.drafts.length" class="fag-drafts" aria-label="Draf kartu">
      <div class="fag-drafts-head">
        <p class="text-sm">
          <strong>{{ store.drafts.length }} draf</strong> — belum disimpan. Periksa, edit, atau hapus centang sebelum menyimpan.
          <span v-if="lastSource === 'demo'" class="badge badge-warning" data-testid="ai-demo-badge">contoh (mode demo)</span>
        </p>
      </div>
      <div v-for="d in store.drafts" :key="d.uid" class="card fag-draft" :class="{ off: !d.selected }" data-testid="ai-draft">
        <label class="fag-check">
          <input type="checkbox" :checked="d.selected" :aria-label="`Pilih draf ${d.front}`" @change="store.updateDraft(d.uid, { selected: ($event.target as HTMLInputElement).checked })" />
          <span class="badge badge-neutral">draft</span>
        </label>
        <div class="fag-fields">
          <textarea class="form-textarea" rows="2" :value="d.front" aria-label="Sisi depan" maxlength="300" @input="store.updateDraft(d.uid, { front: ($event.target as HTMLTextAreaElement).value })" />
          <textarea class="form-textarea" rows="2" :value="d.back" aria-label="Sisi belakang" maxlength="800" @input="store.updateDraft(d.uid, { back: ($event.target as HTMLTextAreaElement).value })" />
        </div>
        <button type="button" class="btn btn-ghost btn-xs" :aria-label="`Buang draf ${d.front}`" @click="store.removeDraft(d.uid)">✕</button>
      </div>
      <div class="fag-actions">
        <button type="button" class="btn btn-primary" :disabled="store.selectedDraftCount === 0 || saving" data-testid="ai-save" @click="save">
          Simpan {{ store.selectedDraftCount }} kartu
        </button>
        <button type="button" class="btn btn-secondary btn-sm" @click="store.clearDrafts()">Buang semua draf</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.fag { display: flex; flex-direction: column; gap: 1rem; }
.fag-form { padding: 1rem 1.25rem; display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; }
.fag-form .form-group { margin: 0; flex: 1 1 260px; }
.fag-form .fag-count { flex: 0 0 120px; }
.fag-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.fag-drafts { display: flex; flex-direction: column; gap: 0.6rem; }
.fag-drafts-head { color: var(--color-neutral-800); }
.fag-draft { padding: 0.75rem; display: grid; grid-template-columns: auto 1fr auto; gap: 0.75rem; align-items: start; }
.fag-draft.off { opacity: 0.55; }
.fag-check { display: flex; flex-direction: column; gap: 0.35rem; align-items: center; padding-top: 0.35rem; }
.fag-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
@media (max-width: 640px) { .fag-fields { grid-template-columns: 1fr; } }
</style>
