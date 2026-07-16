# 📚 LMS Mahasiswa

**Learning Management System** untuk mahasiswa dan instruktur — dibangun dengan Nuxt 4, Vue 3, TypeScript, Pinia, dan Supabase.

> 🚀 **Live Demo**: [nuxt-lms-mahasiswa.vercel.app](https://nuxt-lms-mahasiswa.vercel.app)

---

## ✨ Fitur

### 🎓 Untuk Mahasiswa
- **Dashboard** — Ringkasan aktivitas belajar, progress, dan statistik
- **Mata Kuliah** — Daftar MK yang diikuti, detail materi, dan progress per MK
- **Materi** — Belajar materi perkuliahan, tandai selesai, navigasi prev/next
- **Tugas** — Lihat tugas, deadline, kumpulkan jawaban, lihat nilai & feedback
- **Profil** — Lihat data diri (NPM, kelas, level, sesi)

### 👨‍🏫 Untuk Instruktur (3 instruktur)
- **Dashboard** — Ringkasan MK yang diampu
- **Mata Kuliah** — Kelola materi (tambah/hapus), kelola tugas, lihat mahasiswa terdaftar
- **Tugas** — Buat tugas baru, beri nilai & feedback pada submission
- **Mahasiswa** — Lihat seluruh mahasiswa terdaftar per level & sesi
- **Profil** — Lihat data diri

### 🔧 Fitur Teknis
- Login role-based (Mahasiswa via Nama+NPM+Password, Instruktur via Nama+Password, Admin via Password)
- Show/hide toggle 👁️ pada semua field password
- Admin CRUD Mahasiswa & Instruktur (Demo mode + Supabase production)
- 4 Level kelas (1–4) dengan sesi Pagi & Malam
- **Demo Mode** — Bisa dijalankan tanpa Supabase (data bawaan)
- Responsive design (desktop & mobile)

---

## 🏗️ Tech Stack

| Teknologi | Versi | Kegunaan |
|---|---|---|
| **Nuxt** | ^4.4.8 | Full-stack framework (Vue 3 + Nitro) |
| **Vue** | ^3.5.39 | UI framework |
| **TypeScript** | strict | Type safety |
| **Pinia** | ^3.0.4 | State management |
| **Supabase** | ^2.110.4 | Database & Auth (opsional, demo mode default) |
| **Nitro** | ^2.13.4 | Server engine (Vercel preset) |
| **Vite** | ^7.3.6 | Build tool |

---

## 🚀 Panduan Memulai

### Prasyarat
- Node.js 18+
- npm 9+

### Instalasi

```bash
# Clone repositori
git clone https://github.com/mwyzer/vue-lms-mahasiswa.git
cd nuxt-lms-mahasiswa

# Install dependencies
npm install

# Jalankan development server
npm run dev
```

Buka `http://localhost:3000` di browser.

### Demo Mode (Default)

Tanpa konfigurasi apapun, aplikasi berjalan dalam **Demo Mode** dengan data bawaan:

**Login Mahasiswa:**
1. Pilih role **Mahasiswa**
2. Pilih **Level** (1–4)
3. Pilih sesi **Pagi** atau **Malam**
4. Klik nama dari daftar (contoh: `Ahmad Fauzi` — `20241001`)
5. Masukkan password: `mahasiswa123`

**Login Instruktur:**
1. Pilih role **Instruktur**
2. Pilih instruktur (contoh: `Dr. Andi Wijaya, M.Kom.`)
3. Masukkan password: `instruktur123`

### Mode Production (dengan Supabase) ✅ Terkonfigurasi

Project sudah terhubung ke **Supabase**:
- **URL**: `https://fmibyazumfxrgcehojys.supabase.co`
- **Status**: Demo mode `false` — menggunakan database nyata

Jalankan SQL dari folder `supabase/` di Supabase SQL Editor:
1. `supabase/schema.sql` — Buat tabel
2. `supabase/policies.sql` — RLS policies
3. `supabase/seed.sql` — Data awal

---

## 🗂️ Struktur Project

```
lms-mahasiswa/
├── app/
│   ├── assets/css/        # Global styles (main.css)
│   ├── composables/       # Vue composables (useAuth, useCourses, etc.)
│   ├── layouts/           # Layouts (default, dashboard, instructor)
│   ├── middleware/        # Route middleware (auth, guest, student, instructor)
│   ├── pages/             # Halaman aplikasi
│   │   ├── index.vue                  # Landing page
│   │   ├── login.vue                  # Multi-step login
│   │   ├── dashboard.vue             # Student dashboard
│   │   ├── profile.vue               # Student profile
│   │   ├── courses/                  # Student courses
│   │   ├── assignments/              # Student assignments
│   │   └── instructor/               # Instructor pages
│   ├── plugins/           # Nuxt plugins (supabase.client.ts)
│   ├── stores/            # Pinia stores (auth, courses, assignments, ui)
│   └── types/             # TypeScript interfaces
├── docs/                  # Dokumentasi PRD
├── supabase/              # SQL schema, policies, seed
├── nuxt.config.ts         # Nuxt configuration
├── .env.example           # Environment template
└── README.md
```

---

## � Progress Pengembangan

| # | Fase | Status | Keterangan |
|---|------|--------|------------|
| 1 | **Project Setup** | ✅ Selesai | Nuxt 4, TypeScript strict, Pinia, ESLint, CSS global |
| 2 | **Landing Page & Auth UI** | ✅ Selesai | Hero section, multi-step login (role → level → session → roster) |
| 3 | **Supabase Database** | ✅ Selesai | 8 tabel, RLS policies, seed data (3 instruktur, 15 mahasiswa, 13 MK) |
| 4 | **Supabase Auth & Routing** | ✅ Selesai | Auth store, 5 middleware, route guards per role |
| 5 | **Student Dashboard** | ✅ Selesai | Sidebar, stats cards, course grid, mobile drawer |
| 6 | **Courses** | ✅ Selesai | List, detail, filter level/session, progress per MK |
| 7 | **Lesson Progress** | ✅ Selesai | Detail materi, prev/next nav, mark-as-complete |
| 8 | **Assignments** | ✅ Selesai | List, detail, submission form, grade & feedback |
| 9 | **Instructor Module** | ✅ Selesai | Dashboard, CRUD materi & tugas, grading submission |
| 10 | **Profile** | ✅ Selesai | Edit profil (student, instructor, admin) dengan validasi |
| 11 | **Testing & a11y** | ✅ Selesai | Vitest (119 tests), Playwright E2E (3 flows), a11y audits |
| 12 | **Deployment** | ✅ Selesai | Vercel live, README, smoke test |

### 🧪 Test Coverage

| Tipe | Teknologi | Jumlah | Status |
|------|-----------|--------|--------|
| **Unit Test (Stores)** | Vitest | 74 tests | ✅ Pass |
| **Unit Test (Components)** | Vitest + Vue Test Utils | 25 tests | ✅ Pass |
| **E2E (Student Flow)** | Playwright | 1 spec | ✅ Pass |
| **E2E (Instructor Flow)** | Playwright | 1 spec | ✅ Pass |
| **E2E (Accessibility)** | Playwright | 8 specs | ✅ Pass |

### 🧩 Reusable Components

| Komponen | Lokasi | Kegunaan |
|----------|--------|----------|
| `StatCard` | `app/components/common/StatCard.vue` | Kartu statistik dengan ikon, nilai, dan label |
| `ProgressBar` | `app/components/common/ProgressBar.vue` | Progress bar dengan persentase |
| `EmptyState` | `app/components/common/EmptyState.vue` | Tampilan saat data kosong |
| `SessionBadge` | `app/components/common/SessionBadge.vue` | Badge sesi Pagi/Malam |
| `PageHeader` | `app/components/common/PageHeader.vue` | Header halaman dengan judul & subtitle |

### 🔑 Demo Login

| Role | Nama | Password |
|------|------|----------|
| Mahasiswa | `Ahmad Fauzi` — `20241001` | `mahasiswa123` |
| Instruktur | `Dr. Andi Wijaya, M.Kom.` | `instruktur123` |
| Admin | `Admin LMS` | `admin123` |

---

## �📦 Build & Deploy

```bash
# Production build
npm run build

# Preview build
npm run preview
```

Build sudah dikonfigurasi untuk **Vercel** (`nitro.preset: 'vercel'`).

### Deploy ke Vercel (✅已完成)

Project sudah **live** di:
- **🌐 Production**: [nuxt-lms-mahasiswa.vercel.app](https://nuxt-lms-mahasiswa.vercel.app)
- **📦 GitHub**: [github.com/mwyzer/vue-lms-mahasiswa](https://github.com/mwyzer/vue-lms-mahasiswa)

Untuk deploy ulang atau fork:
1. Clone repo `git clone https://github.com/mwyzer/vue-lms-mahasiswa.git`
2. Import di [vercel.com](https://vercel.com/import)
3. Set environment variables:
   - `NUXT_PUBLIC_SUPABASE_URL` (opsional untuk demo)
   - `NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (opsional untuk demo)
   - `NUXT_PUBLIC_DEMO_MODE` = `true`
4. Deploy! 🎉

---

## � Changelog

### v1.1.0 — Password Security & Admin CRUD Supabase

| Perubahan | Detail |
|-----------|--------|
| **🔐 Password Student Login** | Mahasiswa sekarang wajib memasukkan password setelah memilih nama dari roster |
| **👁️ Show/Hide Password Toggle** | Semua field password di app (login & admin forms) punya toggle tampilkan/sembunyikan |
| **🛠️ Admin CRUD Supabase** | `addStudent`, `updateStudent`, `deleteStudent`, `addInstructor`, `updateInstructor`, `deleteInstructor` kini support **demo mode + Supabase production** |
| **✅ Error Handling** | Save/delete operations menampilkan notifikasi error jika gagal (bukan hanya sukses) |

**Demo Password:**
- Student: `mahasiswa123`
- Instructor: `instruktur123`
- Admin: `admin123`

---

## �📄 Lisensi

MIT © 2026
