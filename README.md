# 📚 LMS Mahasiswa

**Learning Management System** untuk mahasiswa dan instruktur — dibangun dengan Nuxt 4, Vue 3, TypeScript, Pinia, dan Supabase.

> 🚀 **Live Demo**: [lms-mahasiswa.vercel.app](https://lms-mahasiswa.vercel.app)

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
- Login role-based (Mahasiswa via Nama+NPM, Instruktur via Nama+Password)
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
git clone https://github.com/<username>/lms-mahasiswa.git
cd lms-mahasiswa

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

**Login Instruktur:**
1. Pilih role **Instruktur**
2. Pilih instruktur (contoh: `Dr. Andi Wijaya, M.Kom.`)
3. Masukkan password: `instruktur123`

### Mode Production (dengan Supabase)

1. Buat project di [supabase.com](https://supabase.com)
2. Jalankan SQL dari folder `supabase/`:
   - `supabase/schema.sql` — Buat tabel
   - `supabase/policies.sql` — RLS policies
   - `supabase/seed.sql` — Data awal
3. Copy `.env.example` ke `.env` dan isi credentials:
   ```env
   NUXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   NUXT_PUBLIC_DEMO_MODE=false
   ```

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

## 📦 Build & Deploy

```bash
# Production build
npm run build

# Preview build
npm run preview
```

Build sudah dikonfigurasi untuk **Vercel** (`nitro.preset: 'vercel'`).

### Deploy ke Vercel

1. Push repo ke GitHub
2. Import di [vercel.com](https://vercel.com/import)
3. Set environment variables:
   - `NUXT_PUBLIC_SUPABASE_URL` (opsional untuk demo)
   - `NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (opsional untuk demo)
   - `NUXT_PUBLIC_DEMO_MODE` = `true`
4. Deploy! 🎉

---

## 📄 Lisensi

MIT © 2026

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
