# UI Components & Design System

> Dokumentasi lengkap komponen UI, class utilities, dan design system yang digunakan dalam LMS Mahasiswa.

---

## Daftar Isi

- [1. Design Tokens (CSS Variables)](#1-design-tokens-css-variables)
- [2. Layout](#2-layout)
- [3. Common Components](#3-common-components)
- [4. Form Elements](#4-form-elements)
- [5. Buttons](#5-buttons)
- [6. Cards](#6-cards)
- [7. Badges](#7-badges)
- [8. Utility Classes](#8-utility-classes)
- [9. Admin CRUD Patterns](#9-admin-crud-patterns)
- [10. Notification System](#10-notification-system)
- [11. Responsive Breakpoints](#11-responsive-breakpoints)
- [12. Vuestic UI Integration](#12-vuestic-ui-integration)
- [13. Dark Mode](#13-dark-mode)

---

## 1. Design Tokens (CSS Variables)

Semua token tema didefinisikan di `:root` dalam `app/assets/css/main.css`.

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary-50` | `#eff6ff` | Sidebar active bg |
| `--color-primary-100` | `#dbeafe` | Badge primary bg |
| `--color-primary-500` | `#3b82f6` | Input focus border |
| `--color-primary-600` | `#2563eb` | Button primary bg |
| `--color-primary-700` | `#1d4ed8` | Button primary hover |
| `--color-primary-800` | `#1e40af` | Link hover, badge text |
| `--color-neutral-50` | `#f8fafc` | Body bg |
| `--color-neutral-100` | `#f1f5f9` | Hover bg, badge neutral |
| `--color-neutral-200` | `#e2e8f0` | Borders, skeleton |
| `--color-neutral-300` | `#cbd5e1` | Input border |
| `--color-neutral-500` | `#64748b` | Muted text |
| `--color-neutral-600` | `#475569` | Nav item text |
| `--color-neutral-700` | `#334155` | Form label |
| `--color-neutral-800` | `#1e293b` | Body text |
| `--color-neutral-900` | `#0f172a` | Heading text |

### Semantic Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-success` | `#22c55e` | Success state |
| `--color-error` | `#ef4444` | Error/danger state |
| `--color-warning` | `#f59e0b` | Warning state |
| `--color-info` | `#3b82f6` | Info state |

### Typography

| Token | Value |
|-------|-------|
| `--font-sans` | `'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif` |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', 'Consolas', monospace` |

### Spacing & Sizing

| Token | Value |
|-------|-------|
| `--spacing-unit` | `0.25rem` (4px base) |
| `--radius-sm` | `0.375rem` |
| `--radius-md` | `0.5rem` |
| `--radius-lg` | `0.75rem` |
| `--radius-xl` | `1rem` |
| `--sidebar-width` | `260px` |
| `--header-height` | `64px` |

### Shadows

| Token | Value |
|-------|-------|
| `--shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` |
| `--shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` |
| `--shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` |

---

## 2. Layout

### Dashboard Layout (`app/layouts/dashboard.vue`)

Layout untuk role **Student**. Menggunakan struktur sidebar tetap + konten utama + bottom navigation mobile.

```
┌──────────────┬──────────────────────────────┐
│   Sidebar    │         Top Bar              │
│   (fixed)    │                              │
│              ├──────────────────────────────┤
│  • Dashboard │                              │
│  • Courses   │       Main Content           │
│  • Tugas     │                              │
│  • Nilai     │                              │
│  • Kuis      │                              │
│  • Presensi  │                              │
│  • Kalender  │                              │
│  • AI Tutor  │                              │
│  • Python    │                              │
│  • Profil    │                              │
│              │                              │
│  ──────────  │                              │
│  User Info   │                              │
│  [Keluar]    │                              │
└──────────────┴──────────────────────────────┘
     ↑ Sidebar          ↑ Main Area (margin-left: 260px)
```

Key CSS classes:
- `.dashboard-layout` — Flex container, `min-height: 100vh`
- `.sidebar` — Fixed left, `width: var(--sidebar-width)`, `height: 100vh`
- `.sidebar-overlay` — Mobile overlay (hidden on desktop)
- `.sidebar-header` — Logo area, `height: var(--header-height)`
- `.sidebar-nav` — Scrollable nav items container
- `.nav-item` — Individual nav link (`.active` state highlight)
- `.sidebar-footer` — User info + logout at bottom
- `.main-area` — Content area with `margin-left: var(--sidebar-width)`
- `.topbar` — Top bar with hamburger toggle
- `.content` — Main content padding area
- `.bottom-nav` — Bottom navigation bar (mobile only)

### Instructor Layout (`app/layouts/instructor.vue`)

Struktur identik dengan Dashboard Layout, dengan navigasi khusus instruktur:

- Dashboard, Mata Kuliah, Tugas, Kuis, Mahasiswa, Presensi, Kalender, AI Tutor, Python, Profil

### Admin Layout (`app/layouts/admin.vue`)

Struktur identik, navigasi khusus admin:

- Dashboard, Mata Kuliah, Tugas, **Kuis**, Mahasiswa, Instruktur, Profil

---

## 3. Common Components

Semua komponen berada di `app/components/common/`.

### PageHeader

Header halaman konsisten dengan title, subtitle opsional, dan slot `actions`.

```vue
<PageHeader title="Mata Kuliah" subtitle="Kelola seluruh mata kuliah">
  <template #actions>
    <button class="btn btn-primary btn-sm">+ Tambah</button>
  </template>
</PageHeader>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | (required) | Judul halaman |
| `subtitle` | `string` | — | Deskripsi di bawah judul |

| Slot | Description |
|------|-------------|
| `actions` | Tombol aksi di pojok kanan |

### StatCard

Menampilkan statistik dengan icon, value, dan label.

```vue
<StatCard icon="📖" :value="12" label="Mata Kuliah Aktif" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `string` | (required) | Emoji/icon |
| `value` | `string | number` | (required) | Nilai statistik |
| `label` | `string` | (required) | Label deskripsi |
| `bgColor` | `string` | `#dbeafe` | Warna background icon |
| `iconColor` | `string` | `#1d4ed8` | Warna icon |

### ProgressBar

Progress bar dengan label dan persentase.

```vue
<ProgressBar :value="75" label="Progress Belajar" :showPercent="true" :height="8" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | (required) | Persentase (0-100) |
| `label` | `string` | — | Label di sisi kiri |
| `showPercent` | `boolean` | `true` | Tampilkan % di kanan |
| `height` | `number` | `8` | Tinggi bar (px) |

### EmptyState

Ditampilkan ketika list/section tidak memiliki data.

```vue
<EmptyState icon="📭" message="Belum ada tugas tersedia.">
  <button class="btn btn-primary btn-sm">+ Tambah</button>
</EmptyState>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | `string` | `'Tidak ada data.'` | Pesan kosong |
| `icon` | `string` | — | Emoji di atas pesan |

| Slot | Description |
|------|-------------|
| `default` | Konten tambahan (mis. tombol aksi) |

### SessionBadge

Menampilkan badge untuk sesi kelas (Pagi/Malam).

```vue
<SessionBadge session="morning" />  <!-- Pagi (badge-primary) -->
<SessionBadge session="evening" />  <!-- Malam (badge-warning) -->
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `session` | `'morning' | 'evening'` | (required) | Sesi kelas |

### AiChat

Chat interface AI Teaching Assistant dengan message history, streaming, typing indicator.

```vue
<AiChat />
```

Komponen mandiri yang menggunakan composable `useAiChat()`.

### UpdatePrompt

PWA update notification — muncul otomatis ketika service worker mendeteksi versi baru.

Mendengarkan event `sw:update` pada `window`. Menampilkan overlay dengan opsi "Nanti" atau "Muat Ulang".

### LessonSidebar

Sidebar navigasi untuk daftar materi dalam satu mata kuliah. Menampilkan progress bar dan daftar lesson dengan status selesai.

```vue
<LessonSidebar
  course-id="course-1"
  :lessons="courseLessons"
  current-lesson-id="lesson-2"
  course-name="Algoritma dan Pemrograman"
  course-kode="MK101"
  @navigate="goToLesson"
  @close="closeSidebar"
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `courseId` | `string` | (required) | ID mata kuliah |
| `lessons` | `any[]` | (required) | Daftar lesson (dengan `progress.completed`) |
| `currentLessonId` | `string` | (required) | ID lesson yang sedang aktif |
| `courseName` | `string` | — | Nama mata kuliah di header |
| `courseKode` | `string` | — | Kode mata kuliah di header |

| Event | Payload | Description |
|-------|---------|-------------|
| `navigate` | `lessonId: string` | Emitted saat lesson diklik |
| `close` | — | Emitted saat tombol close diklik |

---

## 4. Form Elements

Semua class form didefinisikan di `main.css`.

### Form Structure

```html
<div class="form-group">
  <label class="form-label">Nama Lengkap</label>
  <input class="form-input" type="text" />
  <p class="form-hint">Minimal 2 karakter.</p>
</div>
```

### Input Variants

| Class | Element | Description |
|-------|---------|-------------|
| `.form-input` | `input[type="text"]`, `input[type="number"]`, etc. | Input standar |
| `.form-select` | `select` | Dropdown |
| `.form-textarea` | `textarea` | Textarea with `resize: vertical` |
| `.form-label` | `label` | Label tebal |
| `.form-hint` | `p`, `span` | Hint text (0.75rem) |
| `.form-group` | `div` | Wrapper margin-bottom |
| `.form-actions` | `div` | Tombol aksi rata kanan |
| `.form-readonly` | `div` | Read-only data section |
| `.readonly-row` | `div` | Baris data readonly |
| `.readonly-label` | `span` | Label readonly |
| `.readonly-value` | `span` | Value readonly |
| `.form-card` | `div` | Form panel (admin CRUD pattern) |
| `.confirm-card` | `div` | Konfirmasi delete panel |
| `.confirm-actions` | `div` | Tombol aksi dalam confirm-card |

### Password Toggle

```html
<div class="password-wrapper">
  <input class="form-input" type="password" />
  <button class="password-toggle" @click="toggleShow">👁️</button>
</div>
```

### Form Grid (2-column)

Digunakan di halaman admin untuk form CRUD. Didefinisikan scoped di masing-masing halaman.

```css
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem 1rem;
}

.full-width {
  grid-column: 1 / -1;
}
```

---

## 5. Buttons

Class `.btn` sebagai base, dikombinasikan dengan varian.

### Variants

| Class | Description |
|-------|-------------|
| `.btn` | Base button style |
| `.btn-primary` | Primary action (biru) |
| `.btn-secondary` | Secondary action (abu-abu) |
| `.btn-danger` | Destructive action (merah) |
| `.btn-ghost` | Ghost/transparent |
| `.btn-sm` | Small size |
| `.btn-xs` | Extra small size |
| `.btn-lg` | Large size |

```vue
<button class="btn btn-primary">Simpan</button>
<button class="btn btn-ghost btn-sm">Batal</button>
<button class="btn btn-danger btn-sm">Hapus</button>
```

---

## 6. Cards

| Class | Description |
|-------|-------------|
| `.card` | Base card with white bg, shadow, border, padding |
| `.card-header` | Card header with bottom border |
| `.card-title` | Card title text |
| `.form-card` | Form panel card (admin CRUD) — global in `main.css` |
| `.confirm-card` | Confirm delete card — global in `main.css` |
| `.confirm-actions` | Action buttons inside confirm-card |

### Form Card (Admin Pattern)

Digunakan di halaman admin untuk inline form panel. Class `.form-card` didefinisikan di `main.css`:

```css
/* main.css */
.form-card {
  padding: 1.25rem;
  margin-bottom: 1.25rem;
  border: 1px solid var(--color-primary-300);
  background: #f0f7ff;
}
```

### Confirm Card (Admin Pattern)

Digunakan untuk konfirmasi delete. Class `.confirm-card` didefinisikan di `main.css`:

```css
/* main.css */
.confirm-card {
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
  border: 1px solid var(--color-error);
  background: #fef2f2;
}

.confirm-card p {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  color: #b91c1c;
}

.confirm-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
```


## 7. Badges

| Class | Description |
|-------|-------------|
| `.badge` | Base badge (pill shape) |
| `.badge-primary` | Blue badge |
| `.badge-success` | Green badge |
| `.badge-warning` | Yellow badge |
| `.badge-danger` | Red badge |
| `.badge-neutral` | Gray badge |

```html
<span class="badge badge-success">Aktif</span>
<span class="badge badge-danger">Nonaktif</span>
```

---

## 8. Utility Classes

### Text

| Class | Property |
|-------|----------|
| `.text-center` | `text-align: center` |
| `.text-right` | `text-align: right` |
| `.font-bold` | `font-weight: 700` |
| `.text-sm` | `font-size: 0.875rem` |
| `.text-xs` | `font-size: 0.75rem` |
| `.text-muted` | `color: var(--color-neutral-500)` |

### Margin

| Class | Value |
|-------|-------|
| `.mt-1` | `margin-top: 0.25rem` |
| `.mt-2` | `margin-top: 0.5rem` |
| `.mt-4` | `margin-top: 1rem` |
| `.mt-6` | `margin-top: 1.5rem` |
| `.mt-8` | `margin-top: 2rem` |
| `.mb-2` | `margin-bottom: 0.5rem` |
| `.mb-4` | `margin-bottom: 1rem` |
| `.mb-6` | `margin-bottom: 1.5rem` |

### Flex

| Class | Property |
|-------|----------|
| `.flex` | `display: flex` |
| `.flex-col` | `flex-direction: column` |
| `.items-center` | `align-items: center` |
| `.justify-center` | `justify-content: center` |
| `.justify-between` | `justify-content: space-between` |
| `.gap-2` | `gap: 0.5rem` |
| `.gap-4` | `gap: 1rem` |
| `.gap-6` | `gap: 1.5rem` |

### Layout

| Class | Property |
|-------|----------|
| `.container` | Max-width 1200px, centered |
| `.sr-only` | Screen reader only |
| `.grid` | `display: grid` |

### Loading Skeleton

```html
<div class="skeleton" style="width: 200px; height: 1rem;" />
```

Animated pulse skeleton untuk loading state.

---

## 9. Admin CRUD Patterns

Halaman admin menggunakan pola konsisten untuk CRUD operations. Lihat halaman referensi:
- `app/pages/admin/courses.vue`
- `app/pages/admin/quiz.vue`
- `app/pages/admin/students.vue`
- `app/pages/admin/instructors.vue`

### Pattern: Inline Form Panel

```html
<!-- Tombol trigger -->
<button class="btn btn-primary btn-sm" @click="openAddForm">+ Tambah</button>

<!-- Form panel (tampil setelah klik) -->
<div v-if="showForm" class="card form-card">
  <h3>{{ editingId ? 'Edit' : 'Tambah Baru' }}</h3>
  <div class="form-grid">
    <div class="form-group">
      <label class="form-label">Field</label>
      <input v-model="field" class="form-input" />
    </div>
    <div class="form-group full-width">
      <label class="form-label">Textarea</label>
      <textarea v-model="desc" class="form-textarea" rows="2" />
    </div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" @click="cancelForm">Batal</button>
    <button class="btn btn-primary" :disabled="saving" @click="save">
      {{ saving ? 'Menyimpan...' : 'Simpan' }}
    </button>
  </div>
</div>
```

### Pattern: Confirm Delete Bar

```html
<div v-if="confirmDeleteId" class="card confirm-card">
  <p>Hapus item ini?</p>
  <div class="confirm-actions">
    <button class="btn btn-ghost btn-sm" @click="cancelDelete">Batal</button>
    <button class="btn btn-danger btn-sm" @click="executeDelete">Hapus</button>
  </div>
</div>
```

### State Variables Pattern

```ts
const showForm = ref(false)           // Toggle form visibility
const editingId = ref<string | null>(null)  // null = add mode, string = edit mode
const saving = ref(false)             // Loading state
const confirmDeleteId = ref<string | null>(null)  // null = no confirm, string = confirm
```

### Stats Grid Pattern

```html
<div class="stats-grid">
  <StatCard icon="📖" :value="total" label="Label 1" />
  <StatCard icon="✅" :value="completed" label="Label 2" />
  <StatCard icon="📊" :value="progress + '%'" label="Label 3" />
</div>
```

```css
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}
```

---

## 10. Notification System

Menggunakan composable `useNotification()` (dari `app/composables/useNotification.ts`).

```ts
const notification = useNotification()

notification.success('Data berhasil disimpan!')
notification.error('Terjadi kesalahan: ' + err.message)
notification.warning('Field harus diisi.')
notification.info('Sedang memproses...')
```

| Method | Description |
|--------|-------------|
| `success(msg)` | Notifikasi sukses (hijau) |
| `error(msg)` | Notifikasi error (merah) |
| `warning(msg)` | Notifikasi peringatan (kuning) |
| `info(msg)` | Notifikasi info (biru) |

---

## 11. Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| `≤320px` | Font size turun ke `14px` |
| `≥768px` | Container padding `1.5rem` |
| `≥1024px` | Container padding `2rem` |

### Mobile Sidebar

Di layar kecil (`≤768px`):
- Sidebar disembunyikan (`.sidebar` → `transform: translateX(-100%)`)
- `.sidebar.open` → `transform: translateX(0)`
- `.sidebar-overlay` muncul dengan background semi-transparan
- Bottom navigation bar muncul di bawah layar
- Hamburger button di top bar untuk toggle sidebar

### Bottom Navigation (Mobile)

```css
.bottom-nav {
  display: none; /* hidden on desktop */
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-top: 1px solid var(--color-neutral-200);
  z-index: 99;
}
```

---

## 12. Vuestic UI Integration

LMS Mahasiswa mengintegrasikan **Vuestic UI v1.10** sebagai component library untuk mempercepat pengembangan UI dengan komponen siap pakai yang accessible dan customizable.

### Instalasi

```bash
npm install @vuestic/nuxt
```

### Konfigurasi Nuxt (`nuxt.config.ts`)

```ts
export default defineNuxtConfig({
  modules: ['@pinia/nuxt', '@vite-pwa/nuxt', '@vuestic/nuxt'],

  vuestic: {
    config: {
      colors: {
        variables: {
          primary: '#2563eb',
          secondary: '#475569',
          success: '#22c55e',
          info: '#3b82f6',
          danger: '#ef4444',
          warning: '#f59e0b',
          dark: '#0f172a',
          background: '#f8fafc',
          surface: '#ffffff',
        },
      },
    },
    css: ['typography', 'reset'],
  },
})
```

### Konfigurasi Global (`vuestic.config.ts`)

File `vuestic.config.ts` di root project mendefinisikan:
- **Color variables** — diselaraskan dengan design tokens LMS
- **Color presets** — `light` dan `dark` untuk theme switching
- **Component defaults** — global props untuk `VaButton`, `VaInput`, `VaCard`
- **Breakpoints** — diselaraskan dengan breakpoint LMS

```ts
// vuestic.config.ts
import { defineVuesticConfig } from 'vuestic-ui'

export default defineVuesticConfig({
  colors: {
    variables: { /* ... */ },
    presets: {
      light: { /* ... */ },
      dark: { /* ... */ },
    },
  },
  components: {
    VaButton: { size: 'medium', round: false },
    VaInput: { outline: true },
    VaCard: { outlined: true },
  },
})
```

### Komponen Vuestic yang Tersedia

Semua komponen Vuestic UI tersedia secara global via auto-import (Nuxt module).

| Komponen | Penggunaan |
|----------|------------|
| `VaButton` | Tombol dengan variant: `solid`, `outline`, `ghost` |
| `VaInput` | Input field dengan label, validation, masking |
| `VaSelect` | Dropdown select dengan search, multi-select |
| `VaCard` | Kartus konten dengan header, body, footer slots |
| `VaModal` | Modal dialog dengan backdrop, trap focus |
| `VaDataTable` | Tabel data dengan sorting, filtering, pagination |
| `VaBadge` | Badge notifikasi dengan positioning |
| `VaAvatar` | Avatar dengan foto atau inisial |
| `VaToast` | Notifikasi toast (sebagai alternatif custom toast) |
| `VaTabs` | Tab navigasi |
| `VaSidebar` / `VaSidebarItem` | Sidebar navigasi |
| `VaNavbar` | Top navigation bar |
| `VaForm` | Form wrapper dengan validation |
| `VaFileUpload` | Upload file dengan drag & drop |
| `VaProgressBar` | Progress bar dengan variant |
| `VaSkeleton` / `VaSkeletonGroup` | Loading skeleton |
| `VaIcon` | Icon wrapper |
| `VaDivider` | Divider garis |
| `VaChip` | Chip/tag |
| `VaRating` | Rating bintang |
| `VaDropdown` | Dropdown menu |
| `VaInfiniteScroll` | Infinite scroll loader |

### Kapan Menggunakan Vuestic vs Custom CSS

| Situasi | Gunakan |
|----------|---------|
| Tombol, input, modal, tabel, tab | **Vuestic UI** (`VaButton`, `VaInput`, `VaModal`, dll) |
| Layout, card, badge sederhana | **Custom CSS classes** (`.card`, `.badge`, `.btn`) |
| Form read-only, confirm card | **Custom CSS classes** (`.form-readonly`, `.confirm-card`) |
| Statistik card, session badge | **Custom components** (`StatCard`, `SessionBadge`) |

### CSS Modules (Tree Shaking)

Vuestic menyediakan CSS modules yang bisa di-tree-shake:
- `typography` — heading, paragraph, link styles
- `reset` — CSS reset/normalize
- `grid` — flexbox grid system (disabled by default karena LMS menggunakan custom layout)

Konfigurasi di `nuxt.config.ts`: `css: ['typography', 'reset']`

---

## 13. Dark Mode

LMS Mahasiswa mendukung dark mode penuh menggunakan pendekatan **CSS custom properties + `data-theme` attribute**.

### Cara Kerja

1. **CSS Variables** di `:root` mendefinisikan warna light mode
2. **`[data-theme="dark"]`** block di `main.css` meng-override variabel untuk dark mode
3. **UI Store** (`app/stores/ui.ts`) mengelola state `theme` dan persist ke `localStorage`
4. **`document.documentElement.dataset.theme`** di-set saat toggle

### Dark Mode Color Mapping

| Light Token | Dark Override |
|-------------|---------------|
| `--color-neutral-50` (#f8fafc) | #0f172a (dark bg) |
| `--color-neutral-100` (#f1f5f9) | #1e293b (surface) |
| `--color-neutral-200` (#e2e8f0) | #334155 (border) |
| `--color-neutral-800` (#1e293b) | #f1f5f9 (text) |
| `--color-neutral-900` (#0f172a) | #f8fafc (heading) |
| `--color-primary-600` (#2563eb) | #60a5fa (lebih terang) |
| `--color-surface` (#ffffff) | #1e293b |
| `--color-background` (#f8fafc) | #0f172a |
| `--shadow-sm/md/lg` | Opacity ditingkatkan |

### Menggunakan Theme

**Dari komponen Vue:**

```vue
<script setup lang="ts">
const uiStore = useUiStore()
</script>

<template>
  <VaButton @click="uiStore.toggleTheme()">
    {{ uiStore.theme === 'light' ? '🌙 Dark' : '☀️ Light' }}
  </VaButton>
</template>
```

**Dari CSS kustom:**

```css
.my-component {
  background-color: var(--color-surface);
  color: var(--color-neutral-800);
}
```

Semua CSS custom yang menggunakan `var(--color-*)` akan otomatis mengikuti tema.

### Inisialisasi Theme

Panggil `uiStore.initTheme()` sekali saat app mount. Method ini:
1. Membaca preferensi dari `localStorage` (`lms-theme` key)
2. Fallback ke `prefers-color-scheme: dark` media query
3. Mendengarkan perubahan OS-level theme preference

```ts
// Di app.vue atau plugin client-only
const uiStore = useUiStore()
uiStore.initTheme()
```

### Vuestic UI Sync

Vuestic UI `useColors()` composable dapat digunakan untuk sinkronisasi tema di level komponen:

```ts
import { useColors } from 'vuestic-ui'

const { applyPreset } = useColors()

watch(() => uiStore.theme, (theme) => {
  applyPreset(theme) // 'light' | 'dark'
})
```

### File Terkait

| File | Description |
|------|-------------|
| `app/assets/css/main.css` | `:root` tokens + `[data-theme="dark"]` overrides |
| `app/stores/ui.ts` | `theme`, `setTheme()`, `toggleTheme()`, `initTheme()` |
| `vuestic.config.ts` | `presets.light` dan `presets.dark` color variables |
| `nuxt.config.ts` | `vuestic.colors.variables` untuk Vuestic default theme |

---

## Referensi

| File | Description |
|------|-------------|
| `app/assets/css/main.css` | Global styles, tokens, base classes, dark mode overrides |
| `app/components/common/*.vue` | Shared UI components |
| `app/layouts/dashboard.vue` | Student layout with sidebar |
| `app/layouts/instructor.vue` | Instructor layout |
| `app/layouts/admin.vue` | Admin layout |
| `app/pages/admin/*.vue` | Admin CRUD page patterns |
| `vuestic.config.ts` | Vuestic UI global config, color presets, component defaults |
| `app/stores/ui.ts` | Theme state, toggle, persistence |
