<script setup lang="ts">
/**
 * Jalur Belajar Adaptif — weak topics per course from the student's quiz
 * history, with lesson + practice quiz recommendations.
 * Logic: app/utils/learningPath.ts (pure) via app/composables/useLearningPath.ts.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'student'],
})

import { useLearningPath } from '~/composables/useLearningPath'

const { load, loading, error, paths, threshold } = useLearningPath()
const selectedCourse = ref<string | null>(null)

onMounted(load)

const current = computed(() => {
  const list = paths.value
  if (list.length === 0) return null
  return list.find((p) => p.course_id === selectedCourse.value) ?? list[0]!
})

watch(paths, (list) => {
  if (!selectedCourse.value && list.length > 0) {
    // Start with the course that has the most weak topics.
    const first = [...list].sort((a, b) => b.weakTopics.length - a.weakTopics.length || b.attemptsCounted - a.attemptsCounted)[0]
    selectedCourse.value = first?.course_id ?? null
  }
}, { immediate: true })

const hasEstimates = computed(() => current.value?.topics.some((t) => t.estimated) ?? false)

function level(score: number): 'good' | 'mid' | 'weak' {
  if (score >= 80) return 'good'
  if (score >= threshold.value) return 'mid'
  return 'weak'
}
</script>

<template>
  <div class="lp-page">
    <PageHeader
      title="Jalur Belajar Adaptif"
      subtitle="Topik yang perlu diperkuat berdasarkan riwayat kuismu, lengkap dengan materi dan kuis latihan yang disarankan."
    />

    <div v-if="loading" class="card lp-loading" aria-busy="true">Memuat riwayat kuis…</div>
    <div v-else-if="error" class="card lp-error" role="alert">{{ error }}</div>

    <EmptyState v-else-if="paths.length === 0" icon="🧭" message="Kamu belum terdaftar di mata kuliah apa pun." />

    <template v-else>
      <div class="lp-toolbar">
        <div class="lp-tabs" role="tablist" aria-label="Pilih mata kuliah">
          <button
            v-for="p in paths"
            :key="p.course_id"
            type="button"
            role="tab"
            class="lp-tab"
            :class="{ active: current?.course_id === p.course_id }"
            :aria-selected="current?.course_id === p.course_id"
            @click="selectedCourse = p.course_id"
          >
            <span class="lp-tab-kode">{{ p.course_kode }}</span>
            {{ p.course_nama }}
            <span v-if="p.weakTopics.length" class="badge badge-danger">{{ p.weakTopics.length }}</span>
          </button>
        </div>
        <label class="lp-threshold">
          Ambang topik lemah
          <select v-model.number="threshold" class="form-select" data-testid="lp-threshold">
            <option :value="60">&lt; 60</option>
            <option :value="70">&lt; 70</option>
            <option :value="80">&lt; 80</option>
          </select>
        </label>
      </div>

      <template v-if="current">
        <div class="lp-stats">
          <StatCard icon="🎯" :value="current.overall === null ? '–' : `${current.overall}%`" label="Skor rata-rata kuis" variant="primary" />
          <StatCard icon="⚠️" :value="current.weakTopics.length" label="Topik lemah" :variant="current.weakTopics.length ? 'warning' : 'success'" />
          <StatCard icon="📝" :value="current.attemptsCounted" label="Kuis yang dihitung" variant="info" />
        </div>

        <EmptyState v-if="current.attemptsCounted === 0" icon="📝" message="Belum ada hasil kuis untuk mata kuliah ini.">
          <p class="text-sm text-muted">Kerjakan kuis agar sistem dapat mendeteksi topik yang perlu diperkuat.</p>
          <NuxtLink to="/quiz" class="btn btn-primary btn-sm lp-mt">Lihat Kuis</NuxtLink>
        </EmptyState>

        <template v-else>
          <p v-if="hasEstimates" class="lp-note" data-testid="lp-estimate-note">
            ℹ️ Sebagian skor topik (bertanda “estimasi”) dihitung dari nilai kuis keseluruhan karena jawaban per soal tidak tersedia.
          </p>

          <!-- Recommendations -->
          <section class="lp-section" aria-labelledby="lp-rec-heading">
            <h2 id="lp-rec-heading" class="lp-heading">Rekomendasi untukmu</h2>
            <div v-if="current.recommendations.length === 0" class="card lp-allgood" data-testid="lp-all-good">
              🎉 Tidak ada topik di bawah {{ threshold }}%. Pertahankan dengan mengulang flashcard secara rutin.
              <NuxtLink to="/student/flashcards" class="btn btn-secondary btn-sm">Buka Flashcard</NuxtLink>
            </div>
            <div v-else class="lp-rec-list">
              <article v-for="rec in current.recommendations" :key="rec.topic.key" class="card lp-rec" data-testid="lp-rec">
                <header class="lp-rec-head">
                  <h3 class="lp-rec-title">{{ rec.topic.label }}</h3>
                  <span class="lp-score" :class="level(rec.topic.score)">{{ rec.topic.score }}%</span>
                </header>
                <p class="text-sm text-muted">
                  {{ rec.topic.total }} soal dari {{ rec.topic.quiz_ids.length }} kuis
                  <span v-if="rec.topic.estimated" class="badge badge-neutral">estimasi</span>
                </p>
                <ul class="lp-actions">
                  <li v-if="rec.lesson">
                    <NuxtLink :to="`/courses/${rec.lesson.course_id}/lessons/${rec.lesson.id}`" class="lp-link">
                      📖 Pelajari ulang: <strong>{{ rec.lesson.judul }}</strong>
                    </NuxtLink>
                  </li>
                  <li v-if="rec.lesson">
                    <NuxtLink :to="`/student/flashcards?lesson=${rec.lesson.id}`" class="lp-link">
                      🗂️ Buat flashcard dari materi ini
                    </NuxtLink>
                  </li>
                  <li v-for="q in rec.quizzes" :key="q.quiz_id">
                    <NuxtLink :to="`/quiz/${q.quiz_id}`" class="lp-link">
                      ✍️ Latihan: <strong>{{ q.judul }}</strong>
                    </NuxtLink>
                    <span class="text-xs text-muted">
                      · {{ q.topic_questions }} soal topik ini ·
                      {{ q.attempted ? `nilai terakhir ${q.last_percentage}%` : 'belum dicoba' }}
                    </span>
                  </li>
                  <li v-if="!rec.lesson && rec.quizzes.length === 0" class="text-sm text-muted">
                    Belum ada materi atau kuis aktif yang terpetakan ke topik ini. Tanyakan ke AI Tutor atau forum.
                  </li>
                </ul>
              </article>
            </div>
          </section>

          <!-- Scores per topic -->
          <section class="lp-section" aria-labelledby="lp-topic-heading">
            <h2 id="lp-topic-heading" class="lp-heading">Skor per topik</h2>
            <div class="card lp-topics">
              <div v-for="t in current.topics" :key="t.key" class="lp-topic" data-testid="lp-topic">
                <div class="lp-topic-top">
                  <span class="lp-topic-label">
                    {{ t.label }}
                    <span v-if="t.weak" class="badge badge-danger">Lemah</span>
                    <span v-if="t.estimated" class="badge badge-neutral">estimasi</span>
                  </span>
                  <span class="lp-topic-score">{{ t.score }}% <span class="text-xs text-muted">({{ t.total }} soal)</span></span>
                </div>
                <div
                  class="lp-bar"
                  role="progressbar"
                  :aria-valuenow="t.score"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-label="`Skor ${t.label}`"
                >
                  <div class="lp-bar-fill" :class="level(t.score)" :style="{ width: `${t.score}%` }" />
                </div>
              </div>
            </div>
          </section>
        </template>

        <section v-if="current.untestedLessons.length" class="lp-section" aria-labelledby="lp-untested-heading">
          <h2 id="lp-untested-heading" class="lp-heading">Materi yang belum teruji kuis</h2>
          <ul class="card lp-untested">
            <li v-for="l in current.untestedLessons" :key="l.id">
              <NuxtLink :to="`/courses/${l.course_id}/lessons/${l.id}`" class="lp-link">{{ l.judul }}</NuxtLink>
            </li>
          </ul>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.lp-page { display: flex; flex-direction: column; gap: 1.25rem; }
.lp-loading, .lp-error { padding: 1.25rem; }
.lp-error { color: var(--color-error); }
.lp-mt { margin-top: 0.75rem; }

.lp-toolbar { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between; }
.lp-tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.lp-tab {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.45rem 0.85rem; border-radius: var(--radius-pill);
  border: 1px solid var(--color-neutral-200); background: var(--color-surface); color: var(--color-neutral-800);
  font: inherit; font-size: 0.875rem; cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}
.lp-tab:hover { background: var(--color-neutral-100); }
.lp-tab.active { border-color: var(--color-accent); background: var(--color-accent-soft); color: var(--color-accent-deep); }
.lp-tab:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.lp-tab-kode { font-family: var(--font-label); font-size: 0.75rem; color: var(--color-neutral-500); }
.lp-threshold { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: var(--color-neutral-500); }
.lp-threshold .form-select { width: auto; }

.lp-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }

.lp-note {
  padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem;
  background: var(--tint-info-bg, var(--color-primary-50)); color: var(--tint-info-fg, var(--color-primary-700));
  border: 1px solid var(--tint-info-border, var(--color-primary-200));
}

.lp-section { display: flex; flex-direction: column; gap: 0.75rem; }
.lp-heading { font-size: 1.0625rem; font-weight: 600; color: var(--color-neutral-800); }

.lp-allgood { padding: 1rem 1.25rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; justify-content: space-between; color: var(--color-neutral-800); }

.lp-rec-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
.lp-rec { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; border-left: 3px solid var(--color-error); }
.lp-rec-head { display: flex; justify-content: space-between; gap: 0.5rem; align-items: baseline; }
.lp-rec-title { font-size: 1rem; font-weight: 600; color: var(--color-neutral-800); }
.lp-actions { list-style: none; display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.25rem; }
.lp-link { color: var(--color-accent); text-decoration: none; font-size: 0.9rem; }
.lp-link:hover { text-decoration: underline; }

.lp-score { font-family: var(--font-label); font-weight: 700; }
.lp-score.good { color: var(--color-success); }
.lp-score.mid { color: var(--color-warning); }
.lp-score.weak { color: var(--color-error); }

.lp-topics { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.9rem; }
.lp-topic-top { display: flex; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.35rem; font-size: 0.9rem; color: var(--color-neutral-800); }
.lp-topic-label { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
.lp-topic-score { font-family: var(--font-label); white-space: nowrap; }
.lp-bar { height: 8px; border-radius: var(--radius-pill); background: var(--color-neutral-200); overflow: hidden; }
.lp-bar-fill { height: 100%; border-radius: inherit; transition: width var(--dur-base) var(--ease-out); }
.lp-bar-fill.good { background: var(--color-success); }
.lp-bar-fill.mid { background: var(--color-warning); }
.lp-bar-fill.weak { background: var(--color-error); }

.lp-untested { list-style: none; padding: 0.75rem 1.25rem; display: flex; flex-direction: column; gap: 0.4rem; }

@media (prefers-reduced-motion: reduce) {
  .lp-bar-fill, .lp-tab { transition: none; }
}
</style>
