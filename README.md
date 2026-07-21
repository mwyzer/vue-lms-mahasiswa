# 📚 LMS Mahasiswa

**Learning Management System** untuk mahasiswa dan instruktur — dibangun dengan Nuxt 4, Vue 3, TypeScript, Pinia, dan Supabase.

> 🚀 **Live Demo**: [nuxt-lms-mahasiswa.vercel.app](https://nuxt-lms-mahasiswa.vercel.app)

---

## Daftar Isi

1. [Fondasi Produk](#1-fondasi-produk)
2. [Kebutuhan Fungsional](#2-kebutuhan-fungsional)
3. [Teknologi & Arsitektur](#3-teknologi--arsitektur)
4. [Database & Keamanan](#4-database--keamanan)
5. [State Management](#5-state-management)
6. [Non-Fungsional](#6-non-fungsional)
7. [Fase Pengembangan](#7-fase-pengembangan)
8. [Prompt & Aturan](#8-prompt--aturan)
9. [Routing & Autentikasi](#9-routing--autentikasi)
10. [UI Components](#10-ui-components)

---

## 1. Fondasi Produk

### Ringkasan Produk

LMS Mahasiswa adalah aplikasi Learning Management System sederhana yang membantu mahasiswa mengakses mata kuliah, membaca materi, mengerjakan tugas, memantau progres pembelajaran, dan melihat nilai melalui satu dashboard.

Aplikasi menggunakan Nuxt sebagai framework full-stack frontend, Supabase sebagai penyedia autentikasi dan PostgreSQL, serta Pinia untuk mengelola state aplikasi.

MVP berfokus pada pengalaman mahasiswa, instruktur, dan administrator — ketiga role sudah diimplementasikan.

### Latar Belakang

Mahasiswa sering menerima materi, tugas, pengumuman, dan informasi perkuliahan melalui beberapa platform yang berbeda. Hal tersebut dapat menyebabkan:

- Materi sulit ditemukan
- Mahasiswa melewatkan deadline tugas
- Progres pembelajaran tidak terdokumentasi
- Informasi mata kuliah tersebar
- Nilai dan status tugas sulit dipantau
- Pengalaman pembelajaran tidak konsisten

LMS Mahasiswa menyediakan satu aplikasi terpusat untuk mengakses seluruh aktivitas akademik tersebut.

### Tujuan Produk

1. Menyediakan dashboard pembelajaran mahasiswa
2. Menampilkan mata kuliah yang sedang diikuti
3. Menampilkan materi berdasarkan mata kuliah
4. Menyimpan progres penyelesaian materi
5. Menampilkan tugas dan deadline
6. Memungkinkan mahasiswa mengumpulkan tugas
7. Menampilkan status dan nilai tugas
8. Menyediakan autentikasi yang aman
9. Menyediakan aplikasi responsif untuk desktop dan mobile
10. Menyediakan fondasi yang mudah dikembangkan menjadi LMS lengkap

### Target Pengguna

#### Mahasiswa
- Login ke aplikasi
- Melihat ringkasan aktivitas belajar
- Melihat mata kuliah yang sedang diambil
- Membuka materi perkuliahan
- Menandai materi sebagai selesai
- Melihat tugas dan deadline
- Mengirim jawaban tugas
- Melihat status pengumpulan
- Melihat nilai dan feedback
- Mengelola profil pribadi

#### Instruktur (dalam MVP)

Ada 3 instruktur yang mengelola mata kuliah. Setiap instruktur memiliki:
- Login ke aplikasi
- Dashboard instruktur
- Melihat mata kuliah yang diampu
- Membuat dan mengelola materi perkuliahan
- Membuat dan mengelola tugas
- Melihat submission mahasiswa
- Memberikan nilai dan feedback
- Memberikan nilai langsung (tanpa perlu pengumpulan tugas)
- Mengelola presensi mahasiswa tiap pertemuan
- Melihat rekap presensi lintas mata kuliah
- Membuat pengumuman
- Mengelola profil pribadi

#### Administrator (dalam MVP)

- Login ke aplikasi (password: `admin123`)
- CRUD Mahasiswa (tambah, lihat, edit, hapus)
- CRUD Instruktur (tambah, lihat, edit, hapus)
- CRUD Mata Kuliah (tambah, lihat, edit, hapus)
- Lihat assignment seluruh mahasiswa
- Dashboard admin dengan statistik
- Mengelola profil pribadi

### Ruang Lingkup MVP

#### Fitur dalam MVP

- Landing page, login/logout, protected dashboard
- Dashboard overview, daftar & detail mata kuliah
- Level kelas (1–5) dan waktu pelaksanaan (pagi/malam) per mata kuliah
- Daftar & detail materi, progress materi (toggle complete/uncomplete)
- Daftar & detail tugas, pengumpulan tugas (teks/URL)
- Status submission, nilai dan feedback
- Pengumuman, profil mahasiswa
- Dashboard instruktur (3 instruktur)
- CRUD materi & tugas oleh instruktur
- Penilaian submission oleh instruktur
- Penilaian langsung (direct grading) — beri nilai ke semua mahasiswa sekaligus tanpa perlu pengumpulan
- Presensi/kehadiran — instruktur mencatat kehadiran per pertemuan (hadir/izin/sakit/alpha)
- Mahasiswa melihat rekap presensi dan persentase kehadiran sendiri
- Kalender akademik dengan event UTS, UAS, tugas, libur
- Tampilan timeline horizontal pada kalender
- Admin CRUD mahasiswa, instruktur, dan mata kuliah
- Dashboard admin dengan statistik
- Sidebar navigasi pada materi (prev/next + daftar)
- Countdown timer dan karakter counter pada tugas
- AI Chat assistant
- Quiz interaktif (pilihan ganda, timer, skor otomatis)
- Demo mode tanpa Supabase
- Deployment ke Vercel

#### Fitur di luar MVP

Video conference, live chat, forum diskusi, plagiarism checker, integrasi pembayaran, integrasi sistem akademik, push/email notification, mobile app native, multi-campus, sertifikat otomatis.

### Roadmap Setelah MVP

- **v1.1:** Forum diskusi, notifikasi email, leaderboard quiz
- **v1.2:** Export nilai, push notification
- **v2.0:** Multi-campus, AI learning assistant (enhanced), analitik pembelajaran, plagiarism checker

### Success Metrics

MVP berhasil jika:

- Pengguna dapat login
- Dashboard hanya dapat diakses setelah login
- Mahasiswa dapat melihat mata kuliah & membaca materi
- Progress materi tersimpan
- Mahasiswa dapat melihat & mengirim tugas
- Instruktur dapat mencatat presensi dan melihat rekap
- Mahasiswa dapat melihat rekap presensi sendiri
- Kalender akademik dengan event UTS, UAS, tugas, libur
- Mahasiswa hanya dapat melihat data sendiri
- Aplikasi responsif, production build & deployment berhasil
- Tidak ada secret key pada frontend
- Seluruh tabel utama memiliki RLS
- Core E2E flow berhasil

---

## 2. Kebutuhan Fungsional

### User Stories

#### Authentication

- Sebagai mahasiswa, saya ingin login dengan Nama + NPM agar dapat mengakses data pembelajaran saya
- Sebagai mahasiswa, saya ingin memilih kelas (level + waktu) lalu memilih nama saya dari daftar
- Sebagai mahasiswa, saya ingin logout agar akun saya tetap aman
- Sebagai instruktur, saya ingin login dengan memilih nama saya dari daftar instruktur
- Sebagai pengguna yang belum login, saya tidak boleh membuka dashboard
- Sebagai pengguna yang sudah login, saya tidak perlu kembali ke halaman login

#### Dashboard

- Sebagai mahasiswa, saya ingin melihat jumlah mata kuliah aktif
- Sebagai mahasiswa, saya ingin melihat tugas yang belum selesai
- Sebagai mahasiswa, saya ingin melihat deadline terdekat
- Sebagai mahasiswa, saya ingin melihat progres pembelajaran
- Sebagai mahasiswa, saya ingin melihat pengumuman terbaru
- Sebagai mahasiswa, saya ingin melihat tugas mendatang di dashboard
- Sebagai instruktur, saya ingin melihat ringkasan mata kuliah yang saya ampu
- Sebagai admin, saya ingin melihat ringkasan seluruh mahasiswa, instruktur, dan mata kuliah

#### Mata Kuliah

- Sebagai mahasiswa, saya ingin melihat mata kuliah yang saya ikuti
- Sebagai mahasiswa, saya ingin mencari mata kuliah
- Sebagai mahasiswa, saya ingin membuka detail mata kuliah
- Sebagai mahasiswa, saya ingin melihat dosen/instruktur dan deskripsi mata kuliah
- Sebagai mahasiswa, saya ingin melihat level kelas (1–5) dan waktu pelaksanaan (pagi/malam)
- Sebagai mahasiswa, saya ingin melihat daftar materi berdasarkan urutan
- Sebagai instruktur, saya ingin melihat mata kuliah yang saya ampu
- Sebagai instruktur, saya ingin melihat daftar mahasiswa di mata kuliah saya

#### Materi

- Sebagai mahasiswa, saya ingin membaca materi
- Sebagai mahasiswa, saya ingin membuka link atau file materi
- Sebagai mahasiswa, saya ingin menandai materi sebagai selesai/batal selesai (toggle)
- Sebagai mahasiswa, saya ingin melihat persentase progress mata kuliah
- Sebagai mahasiswa, saya ingin navigasi prev/next antar materi
- Sebagai mahasiswa, saya ingin melihat daftar seluruh materi di sidebar
- Sebagai mahasiswa, saya ingin menggunakan shortcut keyboard (←/→) untuk navigasi

#### Tugas

- Sebagai mahasiswa, saya ingin melihat seluruh tugas
- Sebagai mahasiswa, saya ingin memfilter tugas berdasarkan status
- Sebagai mahasiswa, saya ingin mengetahui deadline tugas
- Sebagai mahasiswa, saya ingin melihat countdown waktu tersisa
- Sebagai mahasiswa, saya ingin mengirim jawaban tugas
- Sebagai mahasiswa, saya ingin memperbarui submission sebelum deadline
- Sebagai mahasiswa, saya ingin melihat nilai dan feedback

#### Kalender Akademik

- Sebagai mahasiswa, saya ingin melihat jadwal UTS, UAS, dan libur dalam tampilan kalender
- Sebagai mahasiswa, saya ingin melihat event dalam tampilan daftar, bulan, dan timeline horizontal
- Sebagai mahasiswa, saya ingin memfilter event berdasarkan rentang tanggal pada timeline
- Sebagai instruktur, saya ingin melihat kalender akademik yang sama

#### Presensi / Kehadiran

- Sebagai instruktur, saya ingin mencatat kehadiran mahasiswa per pertemuan (hadir/izin/sakit/alpha)
- Sebagai instruktur, saya ingin melihat rekap kehadiran di semua mata kuliah yang saya ampu
- Sebagai instruktur, saya ingin mengatur jumlah pertemuan dan tanggal presensi
- Sebagai mahasiswa, saya ingin melihat rekap kehadiran saya di setiap mata kuliah
- Sebagai mahasiswa, saya ingin melihat persentase kehadiran saya

#### Penilaian Langsung

- Sebagai instruktur, saya ingin memberi nilai ke semua mahasiswa sekaligus tanpa perlu menunggu pengumpulan tugas
- Sebagai instruktur, saya ingin melihat daftar semua mahasiswa terdaftar saat memberi nilai

#### Hasil Penilaian

- Sebagai mahasiswa, saya ingin melihat semua nilai tugas yang sudah dinilai instruktur dalam satu halaman
- Sebagai mahasiswa, saya ingin melihat rata-rata, tertinggi, dan terendah nilai tugas saya
- Sebagai mahasiswa, saya ingin melihat feedback yang diberikan instruktur untuk setiap tugas

#### AI Chat

- Sebagai mahasiswa, saya ingin bertanya tentang materi perkuliahan
- Sebagai mahasiswa, saya ingin mendapatkan bantuan mengerjakan tugas
- Sebagai mahasiswa, saya ingin chat dengan AI assistant

#### Profil

- Sebagai mahasiswa, saya ingin melihat profil saya
- Sebagai mahasiswa, saya ingin memperbarui nama dan data profil
- Sebagai mahasiswa, saya ingin melihat NIM dan program studi

### Alur Pengguna

#### Alur Login Mahasiswa

```
Landing Page → /login → Pilih "Mahasiswa" → Pilih Level Kelas (1–5) → Pilih Waktu (Pagi/Malam) → Pilih Nama + NPM dari daftar → Redirect ke /dashboard
```

#### Alur Login Instruktur

```
Landing Page → /login → Pilih "Instruktur" → Pilih Nama dari daftar instruktur → Redirect ke /instructor/dashboard
```

Gagal: Tampilkan pesan error → pengguna dapat mencoba kembali

#### Alur Mempelajari Materi

```
Dashboard → Mata Kuliah → Pilih MK → Pilih Materi → Baca Materi → Tandai Selesai → Progress Diperbarui
```

#### Alur Mengumpulkan Tugas

```
Dashboard → Tugas → Pilih Tugas → Baca Instruksi → Isi Jawaban/URL → Submit → Status: Submitted
```

#### Alur Melihat Nilai

```
Tugas → Filter Graded → Pilih Tugas → Lihat Nilai → Lihat Feedback Dosen
```

#### Alur Presensi (Instruktur)

```
Dashboard Instruktur → Mata Kuliah → Pilih MK → Presensi → Pilih Pertemuan → Atur Tanggal → Pilih Status per Mahasiswa → Simpan Semua
```

#### Alur Melihat Presensi (Mahasiswa)

```
Dashboard → Presensi → Lihat Rekap per MK → Lihat Persentase Kehadiran
```

#### Alur Nilai Langsung (Instruktur)

```
Dashboard Instruktur → Mata Kuliah → Pilih MK → Tugas → Pilih Tugas → Klik "Nilai Semua" → Isi Nilai per Mahasiswa → Simpan Semua
```

### Halaman Aplikasi

#### Mahasiswa Routes

| Route | Halaman | Akses |
|-------|---------|-------|
| `/` | Landing Page | Publik |
| `/login` | Login (pilih role & identitas) | Guest |
| `/dashboard` | Dashboard mahasiswa | Auth |
| `/courses` | Daftar Mata Kuliah | Auth |
| `/courses/[id]` | Detail Mata Kuliah | Auth |
| `/courses/[courseId]/lessons/[lessonId]` | Detail Materi | Auth |
| `/assignments` | Daftar Tugas | Auth |
| `/assignments/[id]` | Detail Tugas | Auth |
| `/profile` | Profil mahasiswa | Auth |
| `/ai/chat` | AI Chat assistant | Auth |
| `/playground` | Code playground (Pyodide) | Auth |
| `/calendar` | Kalender akademik | Auth |
| `/student/attendance` | Presensi saya | Auth |
| `/quiz` | Daftar quiz | Auth |
| `/quiz/[id]` | Kerjakan quiz | Auth |

#### Instruktur Routes

| Route | Halaman | Akses |
|-------|---------|-------|
| `/instructor/dashboard` | Dashboard instruktur | Auth |
| `/instructor/courses` | Daftar MK yang diampu | Auth |
| `/instructor/courses/[id]` | Detail MK + manage | Auth |
| `/instructor/courses/[id]/lessons` | Kelola materi | Auth |
| `/instructor/courses/[id]/lessons/create` | Buat materi | Auth |
| `/instructor/courses/[id]/lessons/[lessonId]` | Lihat materi | Auth |
| `/instructor/courses/[id]/lessons/[lessonId]/edit` | Edit materi | Auth |
| `/instructor/courses/[id]/assignments` | Kelola tugas | Auth |
| `/instructor/courses/[id]/assignments/create` | Buat tugas | Auth |
| `/instructor/courses/[id]/assignments/[assignmentId]` | Lihat submission | Auth |
| `/instructor/courses/[id]/students` | Daftar mahasiswa | Auth |
| `/instructor/courses/[id]/attendance` | Presensi per pertemuan | Auth |
| `/instructor/attendance` | Rekap presensi semua MK | Auth |
| `/instructor/profile` | Profil instruktur | Auth |

#### Admin Routes

| Route | Halaman | Akses |
|-------|---------|-------|
| `/admin/dashboard` | Dashboard admin | Admin |
| `/admin/students` | CRUD Mahasiswa | Admin |
| `/admin/instructors` | CRUD Instruktur | Admin |
| `/admin/courses` | CRUD Mata Kuliah | Admin |
| `/admin/assignments` | Semua tugas | Admin |
| `/admin/profile` | Profil admin | Admin |

#### Shared Routes

| Route | Halaman | Akses |
|-------|---------|-------|
| `/calendar` | Kalender akademik (list, bulan, timeline) | Auth |
| `/student/attendance` | Presensi mahasiswa (lihat rekap) | Auth |

### Landing Page

- Nama aplikasi, deskripsi, keunggulan, tombol login, preview, footer
- Responsif, tanpa horizontal scrolling

### Login

- Pilih role: Mahasiswa atau Instruktur
- Mahasiswa: pilih level kelas (1–5) → pilih waktu (pagi/malam) → pilih nama + NPM dari daftar
- Instruktur: pilih nama dari daftar instruktur
- Loading indicator, pesan error, info demo mode
- Daftar identitas bersumber dari data kelas (seed/database)

### Dashboard (Mahasiswa)

- Sapaan, jumlah MK/tugas, progress, deadline terdekat, MK terbaru, pengumuman
- Skeleton loading, empty state, error state

### Dashboard (Instruktur)

- Sapaan, ringkasan MK yang diampu, jumlah mahasiswa, tugas perlu dinilai

---

## 3. Teknologi & Arsitektur

### Stack Teknologi

#### Frontend

| Teknologi | Keterangan |
|-----------|------------|
| Nuxt 4 | Framework full-stack |
| Vue 3 | UI framework |
| TypeScript | Type safety |
| Composition API | Pattern komponen |
| Pinia | State management |
| Nuxt Router | Routing |
| Custom CSS Variables | Styling (CSS custom properties) |

#### Backend

| Teknologi | Keterangan |
|-----------|------------|
| Supabase Auth | Autentikasi |
| Supabase PostgreSQL | Database |
| Supabase Data API | REST API |
| Supabase Storage | File storage |
| Row Level Security | Otorisasi |

#### Development Tools

VS Code, Node.js 18+, npm, Git, GitHub, ESLint, Vue DevTools, Supabase Dashboard, Vitest, Playwright

#### PWA

- @vite-pwa/nuxt — Progressive Web App dengan auto-update
- Ikon otomatis dari script `scripts/generate-pwa-icons.mjs`
- Manifest, service worker, apple-touch-icon

#### Deployment

- Frontend: Vercel
- Database: Supabase
- Repository: GitHub

### Arsitektur Sistem

```
Browser
   │
   ▼
Nuxt Application
   ├── Pages
   ├── Components
   ├── Pinia Stores
   ├── Middleware
   └── Composables
   │
   ▼
Supabase JavaScript Client
   ├── Authentication
   ├── PostgreSQL
   ├── Row Level Security
   └── Storage
```

**Nuxt bertanggung jawab untuk:** UI, routing, layout, state management, validasi form, pengambilan data, middleware autentikasi, error handling

**Supabase bertanggung jawab untuk:** Akun pengguna, session, penyimpanan data, otorisasi data, penyimpanan file, relasi database

### Struktur Folder

```
lms-mahasiswa/
├── app/
│   ├── assets/css/main.css
│   ├── components/{common,dashboard,courses,lessons,assignments,profile,instructor}/
│   ├── composables/{useAuth,useCourses,useAssignments,useNotification,useAiChat,usePyodide,useExportGrades,useExamGuard}.ts
│   ├── layouts/{default,dashboard,instructor,admin}.vue
│   ├── middleware/{auth,guest,student,instructor,admin}.ts
│   ├── pages/
│   │   ├── index.vue                    # Landing page
│   │   ├── login.vue                    # Login role-based
│   │   ├── dashboard.vue                # Student dashboard
│   │   ├── profile.vue                  # Student profile
│   │   ├── ai/chat.vue                  # AI Chat assistant
│   │   ├── calendar/index.vue           # Kalender akademik
│   │   ├── playground/index.vue         # Code playground (Pyodide)
│   │   ├── courses/{index,[id],[courseId]/lessons/[lessonId]}.vue
│   │   ├── assignments/{index,[id]}.vue
│   │   ├── student/{attendance,grades}/
│   │   ├── quiz/{index,[id]}.vue
│   │   ├── admin/{dashboard,students,instructors,courses,assignments,quiz,profile}.vue
│   │   └── instructor/{dashboard,courses,attendance,profile}/
│   ├── plugins/{supabase.client,pwa.client}.ts
│   ├── stores/{auth,courses,assignments,attendance,calendar,quiz,announcements,ui}.ts
│   ├── types/{database,course,assignment,calendar,roster,quiz}.ts
│   └── app.vue
├── server/
│   ├── api/{admin,ai,auth}/
│   ├── middleware/
│   └── utils/{costTracker,rateLimiter,session}.ts
├── test/
│   ├── setup.ts
│   ├── components/
│   ├── stores/
│   └── e2e/
├── public/{robots.txt,icons/}
├── supabase/{schema,policies,seed,setup}.sql
├── docs/
├── scripts/generate-pwa-icons.mjs
├── .env.example
├── nuxt.config.ts
├── package.json
├── playwright.config.ts
├── vitest.config.ts
└── README.md
```

### Environment Variables

```env
NUXT_PUBLIC_SUPABASE_URL=
NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Ketentuan:
- Publishable key boleh digunakan pada client
- RLS wajib aktif
- Secret key & service role key tidak boleh masuk frontend/repository
- `.env` wajib masuk `.gitignore`

### Performance Targets

- Initial page dapat digunakan dengan cepat
- Route menggunakan lazy loading
- Gambar format modern & lazy loading
- Query hanya ambil kolom diperlukan
- Search menggunakan debounce
- Hindari request API berulang
- Skeleton loading & pagination
- Hindari store global untuk state lokal

**Target Lighthouse:**

| Aspek | Skor Minimal |
|-------|-------------|
| Performance | 85 |
| Accessibility | 90 |
| Best Practices | 90 |
| SEO | 90 |

### Security Requirements

- Gunakan Supabase Authentication & session
- Aktifkan RLS untuk seluruh tabel public
- Jangan percaya data role dari frontend
- Validasi kepemilikan data melalui RLS
- Jangan menyimpan password secara manual
- Jangan cetak token ke console
- Jangan simpan service role key di browser
- Validasi input sebelum insert
- Sanitasi konten dari pengguna
- Batasi ukuran upload
- Gunakan HTTPS pada production
- Hindari `v-html` untuk konten tidak tepercaya

---

## 4. Database & Keamanan

### Database Schema

#### 1. profiles

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK, terhubung ke auth.users.id |
| role | text | 'student' / 'instructor' / 'admin' |
| nama | text | Nama lengkap |
| npm | text | NIM/NPM mahasiswa |
| kelas | text | Kelas mahasiswa |
| level | integer | Level: 1–5 |
| session_time | text | 'morning' / 'evening' |
| email | text | |
| avatar_url | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### 2. courses

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| instructor_id | uuid | FK → profiles.id (role = 'instructor') |
| kode | text | Kode MK (contoh: MK101) |
| nama | text | Nama mata kuliah |
| deskripsi | text | |
| level | integer | Level kelas: 1–5 |
| session_time | text | Waktu: 'morning' / 'evening' |
| color | text | Warna card (hex) |
| icon | text | Emoji icon |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Ketentuan:**
- `level` bernilai 1–5
- `session_time` hanya 'morning' atau 'evening'
- `instructor_id` merujuk ke profil dengan role 'instructor'

#### 3. enrollments

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| student_id | uuid | FK → profiles.id |
| course_id | uuid | FK → courses.id |
| enrolled_at | timestamptz | |
| status | text | active / completed / cancelled |

**Unique constraint:** (student_id, course_id)

#### 4. lessons

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| course_id | uuid | FK → courses.id |
| judul | text | Judul materi |
| konten | text | Isi materi |
| urutan | integer | Urutan materi |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### 5. lesson_progress

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| student_id | uuid | FK → profiles.id |
| lesson_id | uuid | FK → lessons.id |
| completed | boolean | |
| completed_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Unique constraint:** (student_id, lesson_id)

#### 6. assignments

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| course_id | uuid | FK → courses.id |
| instructor_id | uuid | FK → profiles.id |
| judul | text | Judul tugas |
| deskripsi | text | Instruksi tugas |
| tenggat_waktu | timestamptz | Deadline |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### 7. submissions

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| assignment_id | uuid | FK → assignments.id |
| student_id | uuid | FK → profiles.id |
| jawaban | text | Jawaban teks |
| submitted_at | timestamptz | |
| nilai | integer | Score |
| feedback | text | |
| graded_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Unique constraint:** (assignment_id, student_id)

#### 8. academic_events

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| course_id | uuid | FK → courses.id (nullable) |
| judul | text | Nama event |
| deskripsi | text | Deskripsi event |
| tipe | text | 'uts' / 'uas' / 'tugas' / 'libur' / 'acara' |
| color | varchar(7) | Warna event (hex, nullable) |
| tanggal_mulai | timestamptz | Waktu mulai |
| tanggal_selesai | timestamptz | Waktu selesai (nullable) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### 9. attendance

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| course_id | uuid | FK → courses.id (ON DELETE CASCADE) |
| student_id | uuid | FK → profiles.id (ON DELETE CASCADE) |
| instructor_id | uuid | FK → profiles.id (ON DELETE CASCADE) |
| tanggal | date | Tanggal pertemuan |
| status | text | 'hadir' / 'izin' / 'sakit' / 'alpha' — CHECK constraint |
| pertemuan | integer | Nomor pertemuan |
| keterangan | text | Catatan tambahan (nullable) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Unique constraint:** (course_id, student_id, pertemuan)
**Indexes:** idx_attendance_course, idx_attendance_student

#### 10. quizzes

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| course_id | text | FK → courses.id (ON DELETE CASCADE) |
| instructor_id | text | FK → profiles.id (ON DELETE CASCADE) |
| judul | varchar(255) | Judul quiz |
| deskripsi | text | |
| time_limit_minutes | integer | Default 30 |
| passing_score | integer | Default 60 |
| is_active | boolean | Default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### 11. quiz_questions

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| quiz_id | uuid | FK → quizzes.id (ON DELETE CASCADE) |
| pertanyaan | text | |
| pilihan_a | varchar(255) | |
| pilihan_b | varchar(255) | |
| pilihan_c | varchar(255) | |
| pilihan_d | varchar(255) | |
| jawaban_benar | char(1) | CHECK: 'a'/'b'/'c'/'d' |
| urutan | integer | Default 1 |
| created_at | timestamptz | |

#### 12. quiz_attempts

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| quiz_id | uuid | FK → quizzes.id (ON DELETE CASCADE) |
| student_id | text | FK → profiles.id (ON DELETE CASCADE) |
| score | integer | Default 0 |
| total_questions | integer | Default 0 |
| percentage | integer | Default 0 |
| started_at | timestamptz | Default NOW() |
| submitted_at | timestamptz | Default NOW() |

#### 13. quiz_answers

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| quiz_id | uuid | FK → quizzes.id (ON DELETE CASCADE) |
| student_id | text | FK → profiles.id (ON DELETE CASCADE) |
| question_id | uuid | FK → quiz_questions.id (ON DELETE CASCADE) |
| jawaban | char(1) | CHECK: 'a'/'b'/'c'/'d' |
| is_correct | boolean | Default false |
| submitted_at | timestamptz | Default NOW() |

### Row Level Security

#### profiles
- ✅ Semua role: Baca profil sendiri
- ✅ Update profil sendiri
- ✅ Admin: Baca semua profil
- ❌ Ubah role atau ID

#### enrollments
- ✅ Baca enrollment milik sendiri
- ❌ Mendaftarkan diri langsung
- ❌ Ubah enrollment
- ❌ Lihat enrollment mahasiswa lain

#### courses
- ✅ Mahasiswa: Baca mata kuliah published yang diikuti
- ✅ Instruktur: Baca, buat, update, hapus mata kuliah yang diampu (instructor_id = auth.uid)

#### lessons
- ✅ Mahasiswa: Baca materi published dari MK yang diikuti
- ✅ Instruktur: Baca, buat, update, hapus materi dari MK yang diampu

#### lesson_progress
- ✅ Baca progress sendiri
- ✅ Buat progress sendiri
- ✅ Update progress sendiri

#### assignments
- ✅ Mahasiswa: Baca tugas published dari MK yang diikuti
- ✅ Instruktur: Baca, buat, update, hapus tugas dari MK yang diampu

#### submissions
- ✅ Mahasiswa: Baca submission sendiri
- ✅ Mahasiswa: Buat submission sendiri
- ✅ Mahasiswa: Update submission sendiri (belum dinilai)
- ❌ Mahasiswa: Ubah nilai/feedback
- ❌ Mahasiswa: Lihat submission mahasiswa lain
- ✅ Instruktur: Baca submission dari MK yang diampu
- ✅ Instruktur: Update score dan feedback

#### academic_events
- ✅ Semua role login: Baca semua event
- ❌ Ubah, buat, hapus event (dari seed saja)

#### attendance
- ✅ Instruktur: Baca, buat, dan update presensi di MK yang diampu
- ✅ Mahasiswa: Baca presensi milik sendiri
- ❌ Mahasiswa: Ubah presensi
- ❌ Lihat presensi mahasiswa lain

#### quizzes
- ✅ Semua role login: Baca semua quiz
- ✅ Instruktur: Buat, update, hapus quiz di MK yang diampu

#### quiz_questions
- ✅ Semua role login: Baca semua pertanyaan quiz
- ✅ Instruktur: Buat, update, hapus pertanyaan di quiz miliknya

#### quiz_attempts
- ✅ Mahasiswa: Baca attempts milik sendiri
- ✅ Mahasiswa: Buat attempt baru
- ✅ Instruktur: Baca attempts mahasiswa di MK yang diampu

#### quiz_answers
- ✅ Mahasiswa: Baca jawaban milik sendiri
- ✅ Mahasiswa: Simpan jawaban saat mengerjakan quiz
- ✅ Instruktur: Baca jawaban mahasiswa di MK yang diampu

> **Catatan:** Autentikasi menggunakan custom cookie-based HMAC (`lms_session`), bukan Supabase Auth `auth.uid()`. Seluruh RLS policy menggunakan `USING (true) WITH CHECK (true)` karena otorisasi ditangani di level aplikasi melalui middleware dan store.

---

## 5. State Management

### Auth Store

#### State

```ts
user: User | null
profile: Profile | null
loading: boolean
error: string | null
initialized: boolean
role: 'student' | 'instructor' | 'admin' | null
classList: ClassRoster[]
studentRoster: StudentInfo[]
instructorList: Instructor[]
selectedLevel: number | null
selectedSession: string | null
demoMode: boolean
```

#### Actions

```ts
initializeAuth()
fetchClassList()
fetchStudentRoster(level, session)
fetchInstructorList()
loginAsStudent(studentId)
loginAsInstructor(instructorId)
logout()
fetchProfile()
updateProfile(data)
```

#### Getters

```ts
isAuthenticated
isStudent
isInstructor
userName
userInitials
dashboardRoute
```

### Course Store

#### State

```ts
myCourses: CourseWithProgress[]
selectedCourse: Course | null
lessons: LessonWithProgress[]
loading: boolean
error: string | null
searchQuery: string
```

#### Actions

```ts
init()
fetchLessons(courseId)
toggleLessonCompleted(lessonId)
```

#### Getters

```ts
filteredCourses
courseProgress
completedLessons
```

### Assignment Store

#### State

```ts
myAssignments: AssignmentWithCourse[]
selectedAssignment: Assignment | null
mySubmissions: Submission[]
loading: boolean
error: string | null
statusFilter: string
```

#### Actions

```ts
init()
fetchAssignmentById(id)
fetchSubmission(assignmentId)
submitAssignment(assignmentId, data)
updateSubmission(assignmentId, data)
```

#### Getters

```ts
pendingAssignments
gradedAssignments
overdueAssignments
```

### UI Store

#### State

```ts
sidebarOpen: boolean
toast: { message: string, type: string } | null
theme: 'light' | 'dark'
```

#### Actions

```ts
toggleSidebar()
showToast(message, type)
hideToast()
```

### Calendar Store

#### State

```ts
events: AcademicEvent[]
loading: boolean
error: string | null
```

#### Actions

```ts
init()
```

#### Getters

```ts
allEvents
todayEvents
upcomingEvents
eventsByMonth(year, month)
```

### Attendance Store

#### State

```ts
records: AttendanceWithNames[]
loading: boolean
error: string | null
isDemoMode: boolean
initialized: boolean
sbRecords: Attendance[]
```

#### Actions

```ts
init()
setAttendance(data)
getOrCreateMeetingAttendance(courseId, pertemuan, tanggal)
```

#### Getters

```ts
allRecords
recordsByCourse(courseId)
recordsByStudent(studentId)
recordsByMeeting(courseId, pertemuan)
recordsByDate(courseId, tanggal)
totalMeetings(courseId)
studentStats(studentId, courseId)
```

### Quiz Store

#### State

```ts
quizzes: Quiz[]
questions: QuizQuestion[]
attempts: QuizAttempt[]
answers: QuizAnswer[]
loading: boolean
error: string | null
isDemoMode: boolean
initialized: boolean
currentQuiz: Quiz | null
currentQuestions: QuizQuestion[]
timeRemaining: number
```

#### Actions

```ts
init()                              // Fetch all quizzes (Supabase or demo fallback)
fetchQuizById(id)                   // Fetch single quiz with questions
startQuiz(quizId)                   // Begin a quiz attempt, start timer
submitAnswer(questionId, jawaban)   // Submit an answer
finishQuiz()                        // Submit all answers and calculate score
fetchAttempts()                     // Fetch student's attempt history
createQuiz(data)                    // Instructor: create quiz
updateQuiz(id, data)                // Instructor: update quiz
deleteQuiz(id)                      // Instructor: delete quiz
```

---

## 6. Non-Fungsional

### Demo Mode

Aplikasi harus tetap berfungsi ketika Supabase belum dikonfigurasi.

#### Ketentuan

- Email dan password apa pun dapat digunakan untuk login
- Data menggunakan mock lokal (tidak permanen)
- Banner "Demo Mode" harus ditampilkan
- Demo mode tidak aktif di production jika Supabase sudah dikonfigurasi

#### Cakupan Demo

- Login, dashboard, mata kuliah, materi, tugas, nilai, profil, kalender akademik, presensi, AI chat, playground

### Responsive Design

#### Breakpoints

| Perangkat | Lebar |
|-----------|-------|
| Mobile | 320px – 767px |
| Tablet | 768px – 1023px |
| Desktop | 1024px+ |

#### Ketentuan Mobile

- Sidebar → drawer
- Table → card list
- Touch target minimal 44px
- Form satu kolom
- Tidak ada horizontal overflow
- Navigasi dapat digunakan dengan keyboard

### Accessibility

**Target:** WCAG 2.1 Level AA

#### Checklist

- ✅ Semantic HTML
- ✅ Semua input memiliki label
- ✅ Semua tombol dapat digunakan dengan keyboard
- ✅ Focus indicator terlihat
- ✅ Contrast teks mencukupi
- ✅ Gambar memiliki alt text
- ✅ Error form dibaca screen reader
- ✅ Modal dapat ditutup dengan Escape
- ✅ Heading mengikuti urutan benar
- ✅ Warna bukan satu-satunya indikator status

### Error Handling

#### Skenario yang Ditangani

- Koneksi internet terputus
- Supabase tidak dapat diakses
- Session expired
- Login gagal
- Data tidak ditemukan
- RLS menolak query
- Submission gagal
- File terlalu besar
- URL tidak valid
- Environment variable belum diisi

#### Format Pesan Error

```
[Apa yang terjadi]
[Kemungkinan penyebab]
[Tindakan yang dapat dilakukan pengguna]
```

Contoh: *"Tugas gagal dikirim. Periksa koneksi internet Anda dan coba kembali."*

### Testing

#### Unit Testing

- **Tools:** Vitest, Vue Test Utils
- **Cakupan:** Auth store (login, role, middleware), course store (filter, progress), assignment store (status, submission), components (render, props, slots)
- **Total:** 139+ tests (stores + components)

#### Component Testing

- AiChat, EmptyState, PageHeader, ProgressBar, SessionBadge, StatCard — render, props, slots, edge cases

#### E2E Testing (Playwright)

1. Membuka landing page
2. Login mahasiswa (pilih role → level → session → nama)
3. Login instruktur (pilih role → nama)
4. Membuka dashboard
5. Membuka mata kuliah
6. Menandai materi selesai
7. Membuka tugas
8. Mengirim submission
9. Membuka profil
10. Logout
11. Route dashboard tidak dapat dibuka setelah logout

#### Aksesibilitas (Playwright a11y)

- 8 spek E2E aksesibilitas (landing, login, dashboard, courses, lessons, assignments, profile, instructor)
- WCAG 2.1 Level AA compliance check

---

## 7. Fase Pengembangan

| Fase | Nama | Fokus Utama | Output |
|------|------|-------------|--------|
| 1 | **Project Setup** | Nuxt 4, TypeScript, Pinia, ESLint, CSS | Project running, type-check & build OK |
| 2 | **Landing Page & Auth UI** | Landing, Login role-based, Demo mode | Landing & login (Nama+NPM) |
| 3 | **Supabase Database** | SQL schema, RLS, seed (3 instruktur, 5 level) | schema.sql, policies.sql, seed.sql |
| 4 | **Supabase Auth & Routing** | Auth store, Middleware, Route structure | Login + routing per role |
| 5 | **Student Dashboard** | Layout, Sidebar, Stats, Announcements | Dashboard mahasiswa responsif |
| 6 | **Courses** | Course list, detail, search, level & session filter | Mahasiswa lihat MK & materi |
| 7 | **Lesson Progress** | Lesson detail, toggle complete, sidebar nav | Progress tersimpan di DB |
| 8 | **Assignments** | List, filter, submission, grade, countdown | Mahasiswa kumpul tugas |
| 9 | **Instructor Module** | Dashboard, manage courses, lessons, assignments, attendance | Instruktur kelola MK & presensi |
| 10 | **Admin Module** | Dashboard admin, CRUD students/instructors/courses | Admin kelola data master |
| 11 | **Profile, AI Chat & Calendar** | Profile edit, AI assistant, playground, kalender akademik | Mahasiswa & instruktur update profil, lihat kalender |
| 12 | **Testing & Deployment** | Vitest, Playwright, a11y, Vercel | Core flow lulus test, live di Vercel |
| 13 | **Attendance & Direct Grading** | Presensi kehadiran, penilaian langsung, timeline view, nav links | Instruktur catat presensi, nilai semua mahasiswa |

### Detail Per Fase

#### Phase 1 — Project Setup

- Inisialisasi Nuxt 4
- Konfigurasi TypeScript strict
- Instal Pinia & Supabase client
- Layout dasar (default & dashboard)
- Global CSS
- `.env.example`
- ESLint & Prettier

#### Phase 2 — Landing Page & Auth UI

- Landing page hero
- Login page dengan role selection (Mahasiswa / Instruktur)
- Dropdown/selector level kelas (1–5) dan waktu (pagi/malam)
- Daftar mahasiswa per kelas (nama + NPM) untuk dipilih
- Daftar instruktur (3 orang) untuk dipilih
- Auth layout
- Loading & error state
- Demo login mode (data dari seed)

#### Phase 3 — Supabase Database

- 13 tabel (profiles, courses, enrollments, lessons, lesson_progress, assignments, submissions, academic_events, attendance, quizzes, quiz_questions, quiz_attempts, quiz_answers)
- Kolom `instructor_id`, `level` (1–5), `session_time` (morning/evening) di tabel courses
- Foreign keys, indexes, unique constraints
- Trigger auto-create profile
- RLS policies (mahasiswa + instruktur + admin)
- Seed data (3 instruktur dengan nama real, mahasiswa per level + session, kelas pagi & malam)

#### Phase 4 — Supabase Auth & Routing

- Supabase plugin (client)
- Auth store: loginAsStudent(id), loginAsInstructor(id), fetchClassList, fetchStudentRoster, fetchInstructorList
- Auth, guest, student, instructor, admin middleware
- Route guard: mahasiswa tidak bisa akses /instructor/*, instruktur tidak bisa akses /student/*
- Redirect post-login: mahasiswa → /dashboard, instruktur → /instructor/dashboard, admin → /admin/dashboard
- Demo mode fallback

#### Phase 5 — Student Dashboard

- Dashboard layout dengan sidebar
- Header dengan nama + NPM
- Mobile menu (drawer)
- Stat cards (MK aktif, tugas pending, progress)
- Recent courses
- Upcoming assignments
- Announcements
- Loading skeleton

#### Phase 6 — Courses

- Course store
- Course list dengan search
- Filter level kelas (1–5) dan waktu pelaksanaan (pagi/malam)
- Course card (tampilkan level, session_time, instruktur)
- Course detail (info + level, session_time, instruktur + lesson list + progress)
- Loading, empty, error states

#### Phase 7 — Lesson Progress

- Lesson detail page
- Previous / next navigation
- Sidebar lesson list
- Toggle complete/uncomplete button
- Keyboard shortcuts (←/→)
- Persist progress ke Supabase
- Progress calculation per course

#### Phase 8 — Assignments

- Assignment store
- Assignment list + search + filters
- Assignment detail
- Countdown timer display
- Character counter on textarea
- Submission form (text + URL)
- Update submission
- Status labels
- Grade & feedback display

#### Phase 9 — Instructor Module

- Instructor dashboard layout (`layouts/instructor.vue`)
- Sidebar navigasi instruktur
- Daftar MK yang diampu
- Detail MK + daftar mahasiswa terdaftar
- CRUD materi (create, read, update, delete)
- CRUD tugas (create, read, update, delete)
- Lihat submission mahasiswa + beri nilai & feedback
- Loading, empty, error states

#### Phase 10 — Admin Module

- Admin dashboard layout (`layouts/admin.vue`)
- Sidebar navigasi admin
- Dashboard admin (total mahasiswa, instruktur, MK, tugas)
- CRUD Mahasiswa (tambah, edit, hapus, lihat)
- CRUD Instruktur (tambah, edit, hapus, lihat)
- CRUD Mata Kuliah (tambah, edit, hapus, lihat)
- Lihat seluruh assignments
- Loading, empty, error states

#### Phase 11 — Profile, AI Chat & Calendar

- Student profile page (nama, NPM, avatar)
- Instructor profile page (nama, email, avatar)
- Admin profile page
- Edit form with validation
- Update ke database
- AI Chat assistant (integration with AI API)
- Code playground with Pyodide (Python execution)
- Kalender akademik (tabel academic_events, calendar store, 3 tampilan: list, bulan, timeline horizontal)
- Success & error messages

#### Phase 12 — Testing & Deployment

- Vitest setup (139+ tests)
- Unit tests (stores)
- Component tests (cards, forms, states)
- Playwright E2E (student + instructor flows, a11y)
- PWA configuration & icons
- Push ke GitHub
- Import ke Vercel
- Environment variables
- Production build
- Smoke test
- README update

#### Phase 13 — Attendance & Direct Grading

- Tabel `attendance` di database
- Attendance store (demo data + Supabase integration)
- CRUD presensi per pertemuan (instructor)
- Rekap presensi lintas MK (instructor)
- Rekap presensi mahasiswa
- Persentase kehadiran per MK (dengan ring warna)
- Nav link "Presensi" di semua layout
- Direct grading: beri nilai ke semua mahasiswa sekaligus
- Tombol "Nilai Semua" pada halaman tugas instruktur
- Halaman hasil penilaian mahasiswa
- Nav link "Nilai" di layout dashboard mahasiswa

---

## 8. Prompt & Aturan

### Aturan Vibe Coding

1. Kerjakan satu fase dalam satu waktu
2. Jangan mengubah fitur di luar fase aktif
3. Jangan menghapus file tanpa alasan jelas
4. Jangan mengganti stack teknologi
5. Gunakan TypeScript strict
6. Gunakan Composition API
7. Gunakan `<script setup lang="ts">`
8. Gunakan komponen kecil dan reusable
9. Jangan taruh seluruh logika dalam satu halaman
10. Gunakan Pinia hanya untuk state global
11. Gunakan `ref` untuk state lokal
12. Gunakan composable untuk logika reusable
13. Jangan taruh service role key pada client
14. Selalu sediakan loading, empty, dan error state
15. Jalankan type-check setelah perubahan besar
16. Jalankan production build sebelum fase selesai
17. Jelaskan file yang dibuat atau diubah
18. Jangan mengubah database tanpa memperbarui SQL
19. Jangan nonaktifkan RLS untuk menyelesaikan error
20. Jangan gunakan `any` kecuali benar-benar diperlukan
21. Jangan gunakan dummy data ketika Supabase aktif
22. Pertahankan demo mode
23. Jangan melanjutkan fase jika build gagal
24. Perbaiki error sebelum menambah fitur baru
25. Update README setelah fitur utama selesai

### Master Prompt Vibe Coding

Prompt siap pakai untuk GitHub Copilot, Claude Code, Cursor, atau AI coding assistant lain.

```markdown
You are a senior Nuxt and Supabase engineer.

Build an LMS Mahasiswa web application based on the PRD.md file in this repository.

Technology requirements:
- Nuxt 4, Vue 3, TypeScript, Composition API, Pinia
- Supabase Authentication, PostgreSQL, Row Level Security
- Responsive CSS, Vercel deployment

Development rules:
1. Read PRD.md before making changes
2. Work only on the requested phase
3. Do not change the technology stack
4. Use <script setup lang="ts">
5. Use TypeScript strict typing
6. Create reusable components
7. Put global state in Pinia
8. Put reusable logic in composables
9. Keep page components simple
10. Provide loading, empty, success, and error states
11. Preserve demo mode when Supabase is not configured
12. Never expose service role keys
13. Never disable RLS as a shortcut
14. Update SQL files when database structure changes
15. Run type-check and production build before marking a phase complete
16. Explain every created or modified file
17. Stop after completing the requested phase
```

### Prompt per Fase

#### Phase 1 — Project Setup

```
Read PRD.md and implement Phase 1 only.
Set up Nuxt 4, TypeScript, Pinia, Supabase client, layouts, global CSS, env example, ESLint, Prettier.
Do not implement application features yet.
Run type-check and production build after implementation.
```

#### Phase 2 — Landing Page & Auth UI

```
Read PRD.md and docs/09-routing-dan-autentikasi.md. Implement Phase 2 only.
Create landing page, login page with role selection (Mahasiswa/Instruktur).
Login is Nama + NPM based: student picks level → session → name from roster.
Instructor picks name from instructor list.
Do not connect real Supabase yet. UI must be responsive and accessible.
```

#### Phase 3 — Supabase Database

```
Read PRD.md and implement Phase 3 only.
Create supabase/schema.sql, policies.sql, seed.sql.
Include all tables, FKs, indexes, constraints, profile trigger, RLS, student policies.
Seed 3 instructors (real names), students per level+session, courses for morning & evening.
Do not disable RLS. Explain SQL execution order.
```

#### Phase 4 — Supabase Auth & Routing

```
Read PRD.md and docs/09-routing-dan-autentikasi.md. Implement Phase 4 only.
Connect Supabase Auth: plugin, Pinia store with loginAsStudent/loginAsInstructor.
Implement auth, guest, student, and instructor middleware.
Set up route structure: /dashboard and /* for students, /instructor/* for instructors.
Redirect to role-specific dashboard after login. Demo mode fallback.
```

#### Phase 5 — Student Dashboard

```
Read PRD.md and docs/09-routing-dan-autentikasi.md. Implement Phase 5 only.
Build student dashboard: layout with sidebar, header (nama + NPM), mobile menu, stat cards, recent courses, upcoming assignments, announcements, loading skeleton, empty/error states.
Use demo data when Supabase unavailable.
```

#### Phase 6 — Courses

```
Read PRD.md and implement Phase 6 only.
Build courses: Pinia store, list, search, cards, detail page, lesson list, progress, states.
Use Supabase when configured, demo data otherwise.
```

#### Phase 7 — Lesson Progress

```
Read PRD.md and implement Phase 7 only.
Build lesson detail: prev/next nav, sidebar lesson list, toggle complete/uncomplete, persist progress, calculate progress, keyboard shortcuts, preserve demo mode.
Respect all RLS policies.
```

#### Phase 8 — Assignments

```
Read PRD.md and implement Phase 8 only.
Build assignments: Pinia store, list, search/filter, detail, countdown timer, character counter, submission form, update, status, grade/feedback.
Students only access own submissions.
```

#### Phase 9 — Instructor Module

```
Read PRD.md and docs/09-routing-dan-autentikasi.md. Implement Phase 9 only.
Build instructor module: dashboard, course management, lesson CRUD, assignment CRUD, view submissions, grade & feedback.
All under /instructor/* routes. Respect RLS policies.
```

#### Phase 10 — Admin Module

```
Read PRD.md and docs/09-routing-dan-autentikasi.md. Implement Phase 10 only.
Build admin module: dashboard layout, sidebar, CRUD students (add/edit/delete), CRUD instructors (add/edit/delete), CRUD courses (add/edit/delete), view all assignments.
All under /admin/* routes. Respect RLS policies.
```

#### Phase 11 — Profile & AI Chat

```
Read PRD.md and implement Phase 11 only.
Build profile for students, instructors, and admins: page, edit form, validation, avatar preview, Supabase update, loading/success/error states.
Build AI Chat assistant page at /ai/chat.
Build code playground at /playground.
Users only update own profile.
```

#### Phase 12 — Testing & Deployment

```
Read PRD.md and implement Phase 12 only.
Add Vitest, Vue Test Utils, Playwright. Write unit (139+), component, and E2E tests (student + instructor flows + a11y).
Prepare PWA icons and configuration.
Prepare for Vercel: review env vars, build scripts, production build, deployment instructions, update README, smoke test routes.
Do not add new features.
```

### Prompt Khusus

#### Bug Fix Prompt

```
Inspect the reported error and fix only the root cause.
Rules:
- Do not rewrite unrelated files
- Do not remove working features
- Do not disable TypeScript
- Do not use any as a shortcut
- Do not disable Supabase RLS
- Preserve demo mode
- Explain root cause, list modified files
- Run type-check and production build
```

#### Code Review Prompt

```
Review the Nuxt LMS codebase against PRD.md.
Check: architecture, TypeScript, Pinia, components, Supabase security, RLS, auth flow, error handling, states, responsive design, a11y, performance, test coverage, Vercel compatibility.
Return: critical, security, functional, quality, a11y, performance issues + recommended fix order.
```

#### Refactoring Prompt

```
Refactor the selected LMS module without changing behavior.
Goals: reduce duplication, improve types, simplify components, move logic to composables, improve stores & error handling.
Preserve Supabase integration, demo mode, and UI behavior.
Run type-check and production build after.
```

---

## 9. Routing & Autentikasi

### Metode Login

Login menggunakan **Nama + NPM** (untuk mahasiswa) atau **Nama** (untuk instruktur), bukan email/password. Data login bersumber dari daftar kelas yang sudah di-seed ke database.

#### Alur Login Mahasiswa

```
Landing Page → /login
    → Pilih role: "Mahasiswa"
    → Pilih Level Kelas (1–5)
    → Pilih Waktu (Pagi / Malam)
    → Lihat daftar mahasiswa di kelas tersebut
    → Klik nama & NPM sendiri
    → Redirect ke /dashboard
```

#### Alur Login Instruktur

```
Landing Page → /login
    → Pilih role: "Instruktur"
    → Lihat daftar 3 instruktur
    → Klik nama sendiri
    → Redirect ke /instructor/dashboard
```

#### Demo Mode

- Data mahasiswa & instruktur diambil dari seed data lokal
- Tidak perlu koneksi Supabase
- Banner "Demo Mode" tetap ditampilkan

#### Production (Supabase)

- Data login tetap dari tabel `profiles` (role = 'student' / 'instructor' / 'admin')
- Autentikasi diverifikasi melalui Supabase Auth + session
- RLS memastikan mahasiswa hanya bisa login sebagai dirinya sendiri

### Route Structure

#### Public Routes

| Route | Halaman | Middleware |
|-------|---------|-----------|
| `/` | Landing Page | — |
| `/login` | Login (pilih role & identitas) | `guest` |

#### Student Routes (Mahasiswa)

| Route | Halaman | Middleware |
|-------|---------|-----------|
| `/dashboard` | Dashboard mahasiswa | `auth` + role check |
| `/courses` | Daftar mata kuliah | `auth` |
| `/courses/[id]` | Detail mata kuliah | `auth` |
| `/courses/[courseId]/lessons/[lessonId]` | Detail materi | `auth` |
| `/assignments` | Daftar tugas | `auth` |
| `/assignments/[id]` | Detail tugas + submission | `auth` |
| `/student/grades` | Hasil penilaian tugas | `auth` |
| `/profile` | Profil mahasiswa | `auth` |
| `/ai/chat` | AI Chat assistant | `auth` |
| `/playground` | Code playground | `auth` |
| `/calendar` | Kalender akademik | `auth` |
| `/student/attendance` | Presensi saya | `auth` |

#### Instructor Routes (Instruktur)

| Route | Halaman | Middleware |
|-------|---------|-----------|
| `/instructor/dashboard` | Dashboard instruktur | `auth` + role check |
| `/instructor/courses` | Daftar MK yang diampu | `auth` |
| `/instructor/courses/[id]` | Detail MK + daftar mahasiswa | `auth` |
| `/instructor/courses/[id]/lessons` | Kelola materi | `auth` |
| `/instructor/courses/[id]/lessons/create` | Buat materi baru | `auth` |
| `/instructor/courses/[id]/lessons/[lessonId]` | Lihat materi | `auth` |
| `/instructor/courses/[id]/lessons/[lessonId]/edit` | Edit materi | `auth` |
| `/instructor/courses/[id]/assignments` | Kelola tugas | `auth` |
| `/instructor/courses/[id]/assignments/create` | Buat tugas baru | `auth` |
| `/instructor/courses/[id]/assignments/[assignmentId]` | Lihat submission mahasiswa | `auth` |
| `/instructor/courses/[id]/students` | Daftar mahasiswa terdaftar | `auth` |
| `/instructor/courses/[id]/attendance` | Presensi per pertemuan | `auth` |
| `/instructor/attendance` | Rekap presensi semua MK | `auth` |
| `/instructor/profile` | Profil instruktur | `auth` |

#### Admin Routes

| Route | Halaman | Middleware |
|-------|---------|-----------|
| `/admin/dashboard` | Dashboard admin | `auth` + role check |
| `/admin/students` | CRUD Mahasiswa | `auth` |
| `/admin/instructors` | CRUD Instruktur | `auth` |
| `/admin/courses` | CRUD Mata Kuliah | `auth` |
| `/admin/assignments` | Semua tugas | `auth` |
| `/admin/profile` | Profil admin | `auth` |

### Middleware

#### `auth` Middleware

- Cek apakah user sudah login (ada di store)
- Jika belum → redirect ke `/login`
- Jika sudah → lanjut

#### `guest` Middleware

- Cek apakah user sudah login
- Jika sudah → redirect ke role-specific dashboard
- Jika belum → lanjut

#### `student` Middleware

- Cek apakah role adalah `student`
- Jika bukan → redirect ke `/instructor/dashboard`
- Jika sudah → lanjut

#### `instructor` Middleware

- Cek apakah role adalah `instructor`
- Jika bukan → redirect ke `/dashboard`
- Jika sudah → lanjut

#### `admin` Middleware

- Cek apakah role adalah `admin`
- Jika bukan → redirect ke `/dashboard`
- Jika sudah → lanjut

### Layout

#### Student Layout (`layouts/dashboard.vue`)

- Sidebar navigasi mahasiswa
- Header dengan nama & avatar
- Menu: Dashboard, Mata Kuliah, Tugas, Nilai, Kuis & Ujian, Presensi, Kalender, AI Tutor, Python, Profil, Logout

#### Instructor Layout (`layouts/instructor.vue`)

- Sidebar navigasi instruktur
- Header dengan nama & avatar
- Menu: Dashboard, Mata Kuliah, Tugas, Mahasiswa, Presensi, Kalender, AI Tutor, Python, Profil, Logout

#### Admin Layout (`layouts/admin.vue`)

- Sidebar navigasi admin
- Header dengan nama & avatar
- Menu: Dashboard, Mata Kuliah, Tugas, Kuis, Mahasiswa, Instruktur, Presensi, Kalender, AI Tutor, Python, Profil, Logout

#### Default Layout (`layouts/default.vue`)

- Landing page
- Minimal header + footer

---

## 10. UI Components

### Design Tokens (CSS Variables)

Semua token tema didefinisikan di `:root` dalam `app/assets/css/main.css`.

#### Color Palette

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

#### Semantic Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-success` | `#22c55e` | Success state |
| `--color-error` | `#ef4444` | Error/danger state |
| `--color-warning` | `#f59e0b` | Warning state |
| `--color-info` | `#3b82f6` | Info state |

#### Typography

| Token | Value |
|-------|-------|
| `--font-sans` | `'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif` |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', 'Consolas', monospace` |

#### Spacing & Sizing

| Token | Value |
|-------|-------|
| `--spacing-unit` | `0.25rem` (4px base) |
| `--radius-sm` | `0.375rem` |
| `--radius-md` | `0.5rem` |
| `--radius-lg` | `0.75rem` |
| `--radius-xl` | `1rem` |
| `--sidebar-width` | `260px` |
| `--header-height` | `64px` |

#### Shadows

| Token | Value |
|-------|-------|
| `--shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` |
| `--shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` |
| `--shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` |

### Layout Components

#### Dashboard Layout (`app/layouts/dashboard.vue`)

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

#### Instructor Layout (`app/layouts/instructor.vue`)

Struktur identik dengan Dashboard Layout, dengan navigasi khusus instruktur:
- Dashboard, Mata Kuliah, Tugas, Kuis, Mahasiswa, Presensi, Kalender, AI Tutor, Python, Profil

#### Admin Layout (`app/layouts/admin.vue`)

Struktur identik, navigasi khusus admin:
- Dashboard, Mata Kuliah, Tugas, Kuis, Mahasiswa, Instruktur, Profil

### Common Components

Semua komponen berada di `app/components/common/`.

#### PageHeader

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

#### StatCard

Menampilkan statistik dengan icon, value, dan label.

```vue
<StatCard icon="📖" :value="12" label="Mata Kuliah Aktif" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `string` | (required) | Emoji/icon |
| `value` | `string \| number` | (required) | Nilai statistik |
| `label` | `string` | (required) | Label deskripsi |
| `bgColor` | `string` | `#dbeafe` | Warna background icon |
| `iconColor` | `string` | `#1d4ed8` | Warna icon |

#### ProgressBar

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

#### EmptyState

Menampilkan pesan ketika tidak ada data.

#### SessionBadge

Menampilkan badge sesi (Pagi/Malam) dengan warna yang sesuai.

#### AiChat

Komponen chat AI assistant dengan streaming response.

### Form Elements

| Class | Purpose |
|-------|---------|
| `.form-group` | Wrapper untuk label + input |
| `.form-label` | Label untuk input field |
| `.form-input` | Standard input field |
| `.form-textarea` | Textarea field |
| `.form-select` | Select dropdown |
| `.form-hint` | Hint text di bawah input |

### Buttons

| Class | Usage |
|-------|-------|
| `.btn` | Base button |
| `.btn-primary` | Primary action |
| `.btn-secondary` | Secondary action |
| `.btn-ghost` | Ghost/transparent button |
| `.btn-danger` | Destructive action |
| `.btn-sm` | Small button |
| `.btn-icon` | Icon-only button |

### Cards

| Class | Usage |
|-------|-------|
| `.card` | Base card container |
| `.course-card` | Course card with hover effect |
| `.form-card` | Form wrapper card |
| `.confirm-card` | Confirmation dialog card |

### Badges

| Class | Usage |
|-------|-------|
| `.badge` | Base badge |
| `.badge-primary` | Primary/blue badge |
| `.badge-warning` | Warning/yellow badge |
| `.badge-neutral` | Neutral/gray badge |
| `.badge-success` | Success/green badge |
| `.badge-danger` | Danger/red badge |

### Utility Classes

| Class | Description |
|-------|-------------|
| `.text-sm` | Small text |
| `.text-muted` | Muted/dimmed text |
| `.font-bold` | Bold text |
| `.full-width` | Full width element |
| `.form-grid` | 2-column responsive form grid |
| `.form-actions` | Form submit/cancel button group |
| `.page-header` | Page title + actions header |
| `.course-grid` | 2-column course card grid |
| `.level-groups` | Level grouping container |
| `.level-title` | Level section heading |
| `.session-group` | Session subgroup (Pagi/Malam) |
| `.session-title` | Session subgroup heading |
| `.course-list` | Vertical course card list |
| `.progress-header` | Progress label + percentage |
| `.progress-bar` | Progress bar container |
| `.progress-fill` | Progress bar fill |
| `.color-picker` | Color swatch picker |
| `.color-swatch` | Individual color swatch |
| `.empty-state` | Empty state container |
| `.loading-state` | Loading spinner container |
| `.spinner` | CSS spinner |

### Admin CRUD Patterns

#### Table Pattern

Digunakan untuk menampilkan data dalam format tabel:

```vue
<div class="card">
  <div class="table-responsive">
    <table class="data-table">
      <thead>...</thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">...</tr>
      </tbody>
    </table>
  </div>
</div>
```

#### Form Pattern

Digunakan untuk create/edit form dalam modal atau inline:

```vue
<div class="card form-card">
  <h3>{{ editingId ? 'Edit' : 'Tambah' }}</h3>
  <div class="form-grid">
    <div class="form-group">...</div>
  </div>
  <div class="form-actions">
    <button class="btn btn-ghost" @click="cancel">Batal</button>
    <button class="btn btn-primary" @click="save">Simpan</button>
  </div>
</div>
```

#### Confirm Delete Pattern

```vue
<div class="card confirm-card">
  <p>Hapus item ini? ...</p>
  <div class="confirm-actions">
    <button class="btn btn-ghost btn-sm" @click="cancelDelete">Batal</button>
    <button class="btn btn-danger btn-sm" @click="executeDelete">Hapus</button>
  </div>
</div>
```

### Notification System

Menggunakan `useNotification` composable:

```ts
const notification = useNotification()
notification.success('Berhasil!')
notification.error('Gagal!')
notification.warning('Perhatian!')
notification.info('Informasi!')
```

### Responsive Breakpoints

| Perangkat | Lebar | Aturan Khusus |
|-----------|-------|--------------|
| Mobile | 320px – 767px | Sidebar → drawer, table → card list, form 1 kolom |
| Tablet | 768px – 1023px | Grid 2 kolom, sidebar overlay |
| Desktop | 1024px+ | Full sidebar, grid 2-4 kolom, table view |

### Vuestic UI Integration

Aplikasi menggunakan **Vuestic UI** (`@vuestic/nuxt` v1.10) komponen untuk komponen kompleks seperti DataTable, Modal, DatePicker, Toast, Form, dan Dropdown. Konfigurasi warna diselaraskan dengan CSS variables melalui `nuxt.config.ts`.

### Dark Mode

Dark mode diimplementasikan melalui CSS custom properties dengan preferensi sistem. Gunakan class `dark` pada root element untuk mengaktifkan mode gelap.

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
2. Pilih **Level** (1–5)
3. Pilih sesi **Pagi** atau **Malam**
4. Klik nama dari daftar (contoh: `Ahmad Fauzi` — `20241001`)
5. Masukkan password: `mahasiswa123`

**Login Instruktur:**
1. Pilih role **Instruktur**
2. Pilih instruktur (contoh: `Dr. Andi Wijaya, M.Kom.`)
3. Masukkan password: `instruktur123`

**Login Admin:**
1. Pilih role **Administrator**
2. Masukkan password: `admin123`

### Mode Production (dengan Supabase)

Project sudah terhubung ke **Supabase**:
- **URL**: `https://fmibyazumfxrgcehojys.supabase.co`
- **Status**: Demo mode `false` — menggunakan database nyata

Jalankan SQL dari folder `supabase/` di Supabase SQL Editor:
1. `supabase/schema.sql` — Buat tabel
2. `supabase/policies.sql` — RLS policies
3. `supabase/seed.sql` — Data awal

### Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run generate     # Static generation
npm run preview      # Preview production build
npm run test         # Run unit tests (Vitest)
npm run typecheck    # TypeScript type check
```

---

## 📊 Progress Pengembangan

| # | Fase | Status | Keterangan |
|---|------|--------|------------|
| 1 | **Project Setup** | ✅ Selesai | Nuxt 4, TypeScript strict, Pinia, ESLint, CSS global |
| 2 | **Landing Page & Auth UI** | ✅ Selesai | Hero section, multi-step login (role → level → session → roster) |
| 3 | **Supabase Database** | ✅ Selesai | 9 tabel, RLS policies, seed data (3 instruktur, 17 mahasiswa, 15 MK) |
| 4 | **Supabase Auth & Routing** | ✅ Selesai | Auth store, 5 middleware, route guards per role |
| 5 | **Student Dashboard** | ✅ Selesai | Sidebar, stats cards, course grid, mobile drawer |
| 6 | **Courses** | ✅ Selesai | List, detail, filter level/session, progress per MK |
| 7 | **Lesson Progress** | ✅ Selesai | Detail materi, prev/next nav, mark-as-complete |
| 8 | **Assignments** | ✅ Selesai | List, detail, submission form, countdown timer, character counter, grade & feedback |
| 9 | **Instructor Module** | ✅ Selesai | Dashboard, CRUD materi & tugas, grading submission |
| 10 | **Admin Module** | ✅ Selesai | Dashboard admin, CRUD students/instructors/courses |
| 11 | **Profile, AI Chat & Calendar** | ✅ Selesai | Edit profil, AI Chat assistant, code playground, kalender akademik |
| 12 | **Testing & Deployment** | ✅ Selesai | Vitest (139+ tests), Playwright E2E, a11y, Vercel live |
| 13 | **Attendance & Direct Grading** | ✅ Selesai | Presensi kehadiran, penilaian langsung, timeline view |

### 🧪 Test Coverage

| Tipe | Teknologi | Jumlah | Status |
|------|-----------|--------|--------|
| **Unit Test (Stores)** | Vitest | 74 tests | ✅ Pass |
| **Unit Test (Components)** | Vitest + Vue Test Utils | 25 tests | ✅ Pass |
| **E2E (Student Flow)** | Playwright | 1 spec | ✅ Pass |
| **E2E (Instructor Flow)** | Playwright | 1 spec | ✅ Pass |
| **E2E (Accessibility)** | Playwright | 8 specs | ✅ Pass |
| **Total** | | **99+ unit + 10 E2E** | ✅ |

### 🔑 Demo Login

| Role | Nama | Password |
|------|------|----------|
| Mahasiswa | `Ahmad Fauzi` — `20241001` | `mahasiswa123` |
| Instruktur | `Dr. Andi Wijaya, M.Kom.` | `instruktur123` |
| Admin | `Admin LMS` | `admin123` |

---

## 📄 Lisensi

MIT © 2026
