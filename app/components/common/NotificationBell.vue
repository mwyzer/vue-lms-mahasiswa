<script setup lang="ts">
/**
 * NotificationBell — topbar bell with unread badge and a dropdown list.
 * Used in the student, instructor and admin layouts.
 */
import { useNotificationsStore } from '~/stores/notifications'
import { useAuthStore } from '~/stores/auth'
import { useAssignmentsStore } from '~/stores/assignments'
import { useCoursesStore } from '~/stores/courses'
import type { AppNotification, NotificationType } from '~/types/database'

const store = useNotificationsStore()
const auth = useAuthStore()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const items = computed(() => store.mine)
const unread = computed(() => store.unreadCount)
const badgeLabel = computed(() => (unread.value > 9 ? '9+' : String(unread.value)))

const ICONS: Record<NotificationType, string> = {
  tugas: '📝',
  nilai: '🏆',
  pengumuman: '📣',
  forum: '💬',
  deadline: '⏰',
  sistem: '🔔',
}

function iconFor(n: AppNotification): string {
  return ICONS[n.tipe] || '🔔'
}

/** Short relative time in Indonesian, e.g. "5 mnt lalu", "2 hari lalu". */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diff)) return ''
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Baru saja'
  if (minutes < 60) return `${minutes} mnt lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function load() {
  if (!auth.user) return
  // Deadline reminders (demo) depend on the student's assignments being loaded.
  if (auth.isStudent) {
    await useCoursesStore().init()
    await useAssignmentsStore().init()
  }
  await store.init()
}

function toggle() {
  open.value = !open.value
}

async function openItem(n: AppNotification) {
  await store.markRead(n.id)
  open.value = false
  if (n.link) await navigateTo(n.link)
}

function onDocumentClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) {
    open.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  load()
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})

// Reload when a different user signs in; clear on logout.
watch(() => auth.user?.id, (id) => {
  if (id) load()
  else store.reset()
})
</script>

<template>
  <div ref="root" class="notif-bell">
    <button
      type="button"
      class="notif-button"
      :aria-label="unread > 0 ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'"
      aria-haspopup="true"
      :aria-expanded="open"
      @click="toggle"
    >
      <span aria-hidden="true">🔔</span>
      <span v-if="unread > 0" class="notif-badge" data-testid="notif-badge">{{ badgeLabel }}</span>
    </button>

    <div v-if="open" class="notif-panel" role="dialog" aria-label="Notifikasi">
      <div class="notif-header">
        <strong>Notifikasi</strong>
        <button
          v-if="unread > 0"
          type="button"
          class="notif-link"
          @click="store.markAllRead()"
        >
          Tandai semua dibaca
        </button>
      </div>

      <p v-if="store.loading" class="notif-empty">Memuat...</p>

      <p v-else-if="items.length === 0" class="notif-empty">
        Belum ada notifikasi.
      </p>

      <ul v-else class="notif-list">
        <li
          v-for="n in items"
          :key="n.id"
          class="notif-item"
          :class="{ unread: !n.read_at }"
        >
          <button type="button" class="notif-main" @click="openItem(n)">
            <span class="notif-icon" aria-hidden="true">{{ iconFor(n) }}</span>
            <span class="notif-text">
              <span class="notif-title">{{ n.judul }}</span>
              <span v-if="n.pesan" class="notif-message">{{ n.pesan }}</span>
              <span class="notif-time">{{ timeAgo(n.created_at) }}</span>
            </span>
          </button>
          <button
            type="button"
            class="notif-remove"
            aria-label="Hapus notifikasi"
            @click="store.remove(n.id)"
          >
            ✕
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.notif-bell {
  position: relative;
  display: inline-flex;
}

.notif-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  font-size: 1.125rem;
  cursor: pointer;
}

.notif-button:hover {
  background-color: var(--color-neutral-100);
}

.notif-button:focus-visible,
.notif-main:focus-visible,
.notif-remove:focus-visible,
.notif-link:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

.notif-badge {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.25rem;
  border-radius: 9999px;
  background-color: var(--color-error);
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1.125rem;
  text-align: center;
}

.notif-panel {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 200;
  width: min(22.5rem, calc(100vw - 2rem));
  max-height: 28rem;
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface);
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.notif-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-neutral-200);
  color: var(--color-neutral-900);
}

.notif-link {
  border: none;
  background: none;
  padding: 0;
  color: var(--color-primary-600);
  font-size: 0.8125rem;
  cursor: pointer;
}

.notif-link:hover {
  text-decoration: underline;
}

.notif-empty {
  margin: 0;
  padding: 1.5rem 1rem;
  text-align: center;
  color: var(--color-neutral-500);
  font-size: 0.875rem;
}

.notif-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  border-bottom: 1px solid var(--color-neutral-100);
}

.notif-item:last-child {
  border-bottom: none;
}

.notif-item.unread {
  background-color: var(--color-primary-50);
}

.notif-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.75rem 0.25rem 0.75rem 1rem;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;
}

.notif-main:hover .notif-title {
  text-decoration: underline;
}

.notif-icon {
  flex-shrink: 0;
  font-size: 1rem;
  line-height: 1.4;
}

.notif-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.notif-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-neutral-900);
  overflow-wrap: anywhere;
}

.notif-item:not(.unread) .notif-title {
  font-weight: 500;
}

.notif-message {
  font-size: 0.8125rem;
  color: var(--color-neutral-600);
  overflow-wrap: anywhere;
}

.notif-time {
  font-size: 0.75rem;
  color: var(--color-neutral-500);
}

.notif-remove {
  flex-shrink: 0;
  margin: 0.5rem 0.5rem 0 0;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-neutral-400);
  font-size: 0.75rem;
  cursor: pointer;
}

.notif-remove:hover {
  background-color: var(--color-neutral-200);
  color: var(--color-neutral-700);
}

/* Small screens: the bell is not flush with the right edge, so pin the panel to the viewport. */
@media (max-width: 640px) {
  .notif-panel {
    position: fixed;
    top: calc(var(--header-height) + 0.25rem);
    left: 0.75rem;
    right: 0.75rem;
    width: auto;
    max-height: calc(100vh - var(--header-height) - 6rem);
  }
}
</style>
