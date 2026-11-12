<script setup lang="ts">
/**
 * ProgressSummaryWidget — compact streak + badges + next badge, for the
 * student dashboard. Links to /student/progress.
 */
import { useProgressStore } from '~/stores/progress'

const progress = useProgressStore()

onMounted(() => {
  progress.init()
})

const streak = computed(() => progress.streak)
const recent = computed(() => progress.earnedBadges.slice(0, 4))
const nextBadge = computed(() =>
  progress.badges
    .filter((b) => !b.earned)
    .sort((a, b) => b.progress.percent - a.progress.percent)[0] ?? null,
)
const completedCourses = computed(() => progress.courseProgress.filter((c) => c.completed).length)
</script>

<template>
  <section class="psw" data-testid="progress-widget" aria-labelledby="psw-title">
    <div class="psw__head">
      <h2 id="psw-title" class="psw__title">🏅 Progres Belajar</h2>
      <NuxtLink to="/student/progress" class="psw__link">Detail →</NuxtLink>
    </div>

    <ClientOnly>
    <div class="psw__body">
      <div class="psw__streak">
        <span class="psw__flame" :class="{ dim: !streak.activeToday }" aria-hidden="true">🔥</span>
        <div>
          <p class="psw__num" data-testid="streak-current">{{ streak.current }} <span>hari</span></p>
          <p class="psw__sub">
            {{ streak.activeToday ? 'Streak aman hari ini' : streak.current > 0 ? 'Belajar hari ini agar streak berlanjut' : 'Mulai streak hari ini' }}
          </p>
        </div>
      </div>

      <div class="psw__stats">
        <div><strong>{{ progress.earnedBadges.length }}</strong><span>badge</span></div>
        <div><strong>{{ streak.longest }}</strong><span>streak terpanjang</span></div>
        <div><strong>{{ completedCourses }}</strong><span>MK tuntas</span></div>
      </div>
    </div>

    <div v-if="recent.length" class="psw__badges" aria-label="Badge terbaru">
      <span v-for="b in recent" :key="b.id" class="psw__chip" :title="b.deskripsi">
        <span aria-hidden="true">{{ b.icon }}</span> {{ b.nama }}
      </span>
    </div>

    <div v-if="nextBadge" class="psw__next">
      <span class="psw__next-label">Berikutnya: {{ nextBadge.icon }} {{ nextBadge.nama }}</span>
      <span class="psw__track" aria-hidden="true"><span class="psw__fill" :style="{ width: nextBadge.progress.percent + '%' }" /></span>
      <span class="psw__next-val">{{ nextBadge.progress.value }}/{{ nextBadge.progress.target }}</span>
    </div>
      <template #fallback>
        <p class="psw__sub">Memuat progres…</p>
      </template>
    </ClientOnly>
  </section>
</template>

<style scoped>
.psw {
  padding: 1rem 1.25rem;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.psw__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.psw__title {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-ink);
  margin: 0;
}

.psw__link {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-accent);
}

.psw__body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.psw__streak {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.psw__flame {
  font-size: 2.25rem;
  line-height: 1;
}

.psw__flame.dim {
  filter: grayscale(0.8);
  opacity: 0.6;
}

.psw__num {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--color-ink);
  margin: 0;
}

.psw__num span {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-ink-muted);
}

.psw__sub {
  font-size: 0.75rem;
  color: var(--color-ink-muted);
  margin: 0;
}

.psw__stats {
  display: flex;
  gap: 1.25rem;
}

.psw__stats div {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.psw__stats strong {
  font-size: 1.125rem;
  color: var(--color-ink);
}

.psw__stats span {
  font-size: 0.6875rem;
  color: var(--color-ink-muted);
}

.psw__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.875rem;
}

.psw__chip {
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-pill);
  background: var(--color-accent-soft);
  color: var(--color-accent-deep);
}

.psw__next {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.625rem;
  margin-top: 0.875rem;
  font-size: 0.75rem;
  color: var(--color-ink-muted);
}

.psw__track {
  display: block;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--color-neutral-200);
  overflow: hidden;
}

.psw__fill {
  display: block;
  height: 100%;
  background: var(--color-accent);
}

@media (max-width: 480px) {
  .psw__next {
    grid-template-columns: 1fr auto;
  }
  .psw__next-label {
    grid-column: 1 / -1;
  }
}
</style>
