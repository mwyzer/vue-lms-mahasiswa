<script setup lang="ts">
/**
 * BadgeGrid — earned badges in full colour, locked ones dimmed with progress.
 */
import { BADGE_TIER_LABEL } from '~/data/badges'
import type { BadgeView } from '~/stores/progress'

defineProps<{
  badges: BadgeView[]
  compact?: boolean
}>()

function earnedDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <ul class="badge-grid" :class="{ compact }">
    <li
      v-for="b in badges"
      :key="b.id"
      class="badge-item"
      :class="[b.earned ? 'earned' : 'locked', `tier-${b.tier}`]"
      :data-badge="b.id"
    >
      <span class="badge-item__icon" aria-hidden="true">{{ b.icon }}</span>
      <div class="badge-item__body">
        <span class="badge-item__name">
          {{ b.nama }}
          <span class="sr-only">{{ b.earned ? '(didapat)' : '(terkunci)' }}</span>
        </span>
        <span v-if="!compact" class="badge-item__desc">{{ b.deskripsi }}</span>
        <span v-if="b.earned" class="badge-item__meta">{{ BADGE_TIER_LABEL[b.tier] }} · {{ earnedDate(b.earned_at) }}</span>
        <template v-else-if="!compact">
          <span class="badge-item__track" aria-hidden="true">
            <span class="badge-item__fill" :style="{ width: b.progress.percent + '%' }" />
          </span>
          <span class="badge-item__meta">{{ b.progress.value }} / {{ b.progress.target }}</span>
        </template>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.badge-grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  gap: 0.75rem;
}

.badge-grid.compact {
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 0.5rem;
}

.badge-item {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.75rem;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.compact .badge-item {
  padding: 0.5rem 0.625rem;
  align-items: center;
}

.badge-item__icon {
  font-size: 1.75rem;
  line-height: 1;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-neutral-100);
  flex-shrink: 0;
}

.compact .badge-item__icon {
  font-size: 1.25rem;
  width: 2rem;
  height: 2rem;
}

.earned.tier-perunggu .badge-item__icon { background: var(--tint-warning-bg, oklch(92% 0.06 70)); }
.earned.tier-perak .badge-item__icon { background: var(--tint-info-bg, oklch(93% 0.03 250)); }
.earned.tier-emas .badge-item__icon { background: var(--tint-warning-bg, oklch(90% 0.12 90)); box-shadow: 0 0 0 2px var(--color-warning); }

.locked .badge-item__icon {
  filter: grayscale(1);
  opacity: 0.45;
}

.badge-item__body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  flex: 1;
}

.badge-item__name {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--color-neutral-800);
}

.locked .badge-item__name {
  color: var(--color-neutral-500);
}

.badge-item__desc {
  font-size: 0.75rem;
  color: var(--color-neutral-500);
}

.badge-item__meta {
  font-size: 0.6875rem;
  color: var(--color-neutral-500);
}

.badge-item__track {
  display: block;
  height: 4px;
  margin-top: 0.25rem;
  border-radius: var(--radius-pill);
  background: var(--color-neutral-200);
  overflow: hidden;
}

.badge-item__fill {
  display: block;
  height: 100%;
  background: var(--color-primary-500);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
