<script setup lang="ts">
/**
 * GlobalSearch — command palette in the topbar (Ctrl/Cmd+K).
 * Searches courses, lessons, quizzes, assignments and forum threads the
 * signed-in user may see, plus navigation commands. Results are grouped by
 * type; ↑/↓/Home/End move, Enter opens, Esc closes.
 * Used in the student, instructor and admin layouts.
 */
import type { SearchGroup, SearchHit } from '~/lib/search'
import { useGlobalSearch } from '~/composables/useGlobalSearch'

const ui = useUiStore()
const auth = useAuthStore()
const { search, ensureLoaded, loading, mode } = useGlobalSearch()

const open = ref(false)
const query = ref('')
const groups = ref<SearchGroup[]>([])
const active = ref(0)
const input = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
let lastFocus: HTMLElement | null = null

const flat = computed<SearchHit[]>(() => groups.value.flatMap((g) => g.items))
const isMac = ref(false)
const shortcutLabel = computed(() => (isMac.value ? '⌘K' : 'Ctrl K'))
const modeLabel = computed(() =>
  mode.value === 'semantic' ? 'Server · semantik' : mode.value === 'lexical' ? 'Server · leksikal' : 'Lokal · leksikal',
)

const optionId = (i: number) => `gs-opt-${i}`
const indexOf = (hit: SearchHit) => flat.value.indexOf(hit)

let timer: ReturnType<typeof setTimeout> | null = null
let runSeq = 0

async function run() {
  const my = ++runSeq
  const res = await search(query.value)
  if (my !== runSeq) return
  groups.value = res
  active.value = 0
}

watch(query, () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(run, ui.isDemoMode ? 80 : 220)
})

async function openPalette() {
  if (open.value || !auth.user) return
  lastFocus = document.activeElement as HTMLElement | null
  open.value = true
  query.value = ''
  await run()
  await nextTick()
  input.value?.focus()
  ensureLoaded()
}

function closePalette() {
  if (!open.value) return
  open.value = false
  nextTick(() => lastFocus?.focus?.())
}

async function choose(hit: SearchHit | undefined) {
  if (!hit) return
  closePalette()
  if (hit.action === 'toggle-theme') {
    ui.toggleTheme()
    return
  }
  if (hit.to) await navigateTo(hit.to)
}

function move(delta: number) {
  const n = flat.value.length
  if (!n) return
  active.value = (active.value + delta + n) % n
  nextTick(() => {
    listEl.value?.querySelector(`#${optionId(active.value)}`)?.scrollIntoView({ block: 'nearest' })
  })
}

function onInputKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); move(1); break
    case 'ArrowUp': e.preventDefault(); move(-1); break
    case 'Home': if (flat.value.length) { e.preventDefault(); active.value = 0; move(0) } break
    case 'End': if (flat.value.length) { e.preventDefault(); active.value = flat.value.length - 1; move(0) } break
    case 'Enter': e.preventDefault(); choose(flat.value[active.value]); break
    case 'Escape': e.preventDefault(); closePalette(); break
    case 'Tab': e.preventDefault(); break // focus stays in the dialog
  }
}

function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    open.value ? closePalette() : openPalette()
  }
}

onMounted(() => {
  isMac.value = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
  window.addEventListener('keydown', onGlobalKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div class="gsearch">
    <button
      type="button"
      class="gsearch-trigger"
      aria-haspopup="dialog"
      :aria-expanded="open"
      aria-label="Cari (Ctrl+K)"
      data-testid="global-search-trigger"
      @click="openPalette"
    >
      <span class="gsearch-trigger__icon" aria-hidden="true">🔍</span>
      <span class="gsearch-trigger__text">Cari…</span>
      <kbd class="gsearch-kbd">{{ shortcutLabel }}</kbd>
    </button>

    <Teleport to="body">
      <div v-if="open" class="gsearch-backdrop" @mousedown.self="closePalette">
        <div
          class="gsearch-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Pencarian global"
          data-testid="global-search"
        >
          <div class="gsearch-inputrow">
            <span class="gsearch-inputrow__icon" aria-hidden="true">🔍</span>
            <input
              ref="input"
              v-model="query"
              class="gsearch-input"
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls="gs-listbox"
              :aria-activedescendant="flat.length ? optionId(active) : undefined"
              placeholder="Cari mata kuliah, materi, kuis, tugas, forum…"
              autocomplete="off"
              spellcheck="false"
              maxlength="200"
              data-testid="global-search-input"
              @keydown="onInputKeydown"
            />
            <button type="button" class="gsearch-esc" aria-label="Tutup pencarian" @click="closePalette">Esc</button>
          </div>

          <div id="gs-listbox" ref="listEl" class="gsearch-results" role="listbox" aria-label="Hasil pencarian">
            <template v-for="g in groups" :key="g.type">
              <div class="gsearch-group" role="presentation">{{ g.label }}</div>
              <div
                v-for="hit in g.items"
                :id="optionId(indexOf(hit))"
                :key="hit.id"
                class="gsearch-option"
                :class="{ active: indexOf(hit) === active }"
                role="option"
                :aria-selected="indexOf(hit) === active"
                :data-type="hit.type"
                @mousemove="active = indexOf(hit)"
                @click="choose(hit)"
              >
                <span class="gsearch-option__icon" aria-hidden="true">{{ hit.icon }}</span>
                <span class="gsearch-option__text">
                  <span class="gsearch-option__title">{{ hit.title }}</span>
                  <span v-if="hit.subtitle" class="gsearch-option__sub">{{ hit.subtitle }}</span>
                </span>
                <span v-if="indexOf(hit) === active" class="gsearch-option__enter" aria-hidden="true">↵</span>
              </div>
            </template>

            <p v-if="loading && !flat.length" class="gsearch-empty">Mencari…</p>
            <p v-else-if="query.trim() && !flat.length" class="gsearch-empty" data-testid="global-search-empty">
              Tidak ada hasil untuk “{{ query.trim() }}”.
            </p>
          </div>

          <div class="gsearch-footer">
            <span><kbd class="gsearch-kbd">↑</kbd><kbd class="gsearch-kbd">↓</kbd> pilih</span>
            <span><kbd class="gsearch-kbd">↵</kbd> buka</span>
            <span class="gsearch-footer__hide-sm"><kbd class="gsearch-kbd">Esc</kbd> tutup</span>
            <span class="gsearch-footer__mode">{{ modeLabel }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.gsearch {
  display: flex;
  align-items: center;
}

.gsearch-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 13rem;
  height: 2.25rem;
  padding: 0 0.5rem 0 0.75rem;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  background: var(--color-neutral-50);
  color: var(--color-neutral-500);
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.gsearch-trigger:hover {
  border-color: var(--color-neutral-300);
  background: var(--color-neutral-100);
}

.gsearch-trigger:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

.gsearch-trigger__text {
  flex: 1;
  text-align: left;
}

.gsearch-kbd {
  display: inline-block;
  min-width: 1.4rem;
  padding: 0.05rem 0.35rem;
  border: 1px solid var(--color-neutral-200);
  border-bottom-width: 2px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-neutral-600);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  line-height: 1.4;
  text-align: center;
}

.gsearch-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 10vh 1rem 1rem;
  background: color-mix(in srgb, var(--color-background) 70%, transparent);
  backdrop-filter: blur(3px);
}

.gsearch-dialog {
  width: 100%;
  max-width: 40rem;
  max-height: 75vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  color: var(--color-neutral-800);
}

.gsearch-inputrow {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-neutral-200);
}

.gsearch-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-neutral-900);
  font: inherit;
  font-size: 1rem;
}

.gsearch-input:focus,
.gsearch-input:focus-visible {
  outline: none;
  box-shadow: none;
  border: none;
}

.gsearch-input::placeholder {
  color: var(--color-neutral-400);
}

.gsearch-input::-webkit-search-cancel-button {
  display: none;
}

.gsearch-esc {
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-sm);
  background: var(--color-neutral-50);
  color: var(--color-neutral-600);
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  cursor: pointer;
}

.gsearch-results {
  flex: 1;
  overflow-y: auto;
  padding: 0.375rem;
  overscroll-behavior: contain;
}

.gsearch-group {
  padding: 0.625rem 0.625rem 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-neutral-500);
}

.gsearch-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.625rem;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.gsearch-option.active {
  background: var(--color-primary-50);
  color: var(--color-primary-700);
}

.gsearch-option__icon {
  width: 1.5rem;
  text-align: center;
  font-size: 1.05rem;
  flex-shrink: 0;
}

.gsearch-option__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.gsearch-option__title {
  font-size: 0.9rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gsearch-option__sub {
  font-size: 0.75rem;
  color: var(--color-neutral-500);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gsearch-option.active .gsearch-option__sub {
  color: var(--color-primary-600);
}

.gsearch-option__enter {
  font-size: 0.85rem;
  color: var(--color-primary-600);
}

.gsearch-empty {
  padding: 1.5rem 1rem;
  text-align: center;
  color: var(--color-neutral-500);
  font-size: 0.875rem;
}

.gsearch-footer {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--color-neutral-200);
  background: var(--color-neutral-50);
  font-size: 0.75rem;
  color: var(--color-neutral-500);
}

.gsearch-footer .gsearch-kbd {
  margin-right: 0.2rem;
}

.gsearch-footer__mode {
  margin-left: auto;
}

@media (max-width: 767px) {
  .gsearch-trigger {
    min-width: 0;
    width: 2.25rem;
    padding: 0;
    justify-content: center;
  }

  .gsearch-trigger__text,
  .gsearch-trigger .gsearch-kbd,
  .gsearch-footer__hide-sm {
    display: none;
  }

  .gsearch-backdrop {
    padding: 0;
    align-items: stretch;
  }

  .gsearch-dialog {
    max-width: none;
    max-height: none;
    height: 100%;
    border-radius: 0;
    border: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .gsearch-trigger { transition: none; }
}
</style>
