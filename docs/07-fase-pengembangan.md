# Bagian 7: Fase Pengembangan (12 Fase)

| Fase | Nama | Fokus Utama | Output |
|------|------|-------------|--------|
| 1 | **Project Setup** | Nuxt 4, TypeScript, Pinia, ESLint, CSS | Project running, type-check & build OK |
| 2 | **Landing Page & Auth UI** | Landing, Login role-based, Demo mode | Landing & login (Nama+NPM) |
| 3 | **Supabase Database** | SQL schema, RLS, seed (3 instruktur, 4 level) | schema.sql, policies.sql, seed.sql |
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

---

## Detail Per Fase

### Phase 1 — Project Setup
- Inisialisasi Nuxt 4
- Konfigurasi TypeScript strict
- Instal Pinia & Supabase client
- Layout dasar (default & dashboard)
- Global CSS
- `.env.example`
- ESLint & Prettier

### Phase 2 — Landing Page & Auth UI
- Landing page hero
- Login page dengan role selection (Mahasiswa / Instruktur)
- Dropdown/selector level kelas (1–4) dan waktu (pagi/malam)
- Daftar mahasiswa per kelas (nama + NPM) untuk dipilih
- Daftar instruktur (3 orang) untuk dipilih
- Auth layout
- Loading & error state
- Demo login mode (data dari seed)

### Phase 3 — Supabase Database
- 8 tabel (profiles, courses, enrollments, lessons, lesson_progress, assignments, submissions, announcements)
- Kolom `instructor_id`, `level` (1–4), `session_time` (morning/evening) di tabel courses
- Foreign keys, indexes, unique constraints
- Trigger auto-create profile
- RLS policies (mahasiswa + instruktur)
- Seed data (3 instruktur dengan nama real, mahasiswa per level + session, kelas pagi & malam)

### Phase 4 — Supabase Auth & Routing
- Supabase plugin (client)
- Auth store: loginAsStudent(id), loginAsInstructor(id), fetchClassList, fetchStudentRoster, fetchInstructorList
- Auth, guest, student, instructor middleware
- Route guard: mahasiswa tidak bisa akses /instructor/*, instruktur tidak bisa akses /student/*
- Redirect post-login: mahasiswa → /dashboard, instruktur → /instructor/dashboard
- Demo mode fallback

### Phase 5 — Student Dashboard
- Dashboard layout dengan sidebar
- Header dengan nama + NPM
- Mobile menu (drawer)
- Stat cards (MK aktif, tugas pending, progress)
- Recent courses
- Upcoming assignments
- Announcements
- Loading skeleton

### Phase 6 — Courses
- Course store
- Course list dengan search
- Filter level kelas (1–4) dan waktu pelaksanaan (pagi/malam)
- Course card (tampilkan level, session_time, instruktur)
- Course detail (info + level, session_time, instruktur + lesson list + progress)
- Loading, empty, error states

### Phase 7 — Lesson Progress
- Lesson detail page
- Previous / next navigation
- Sidebar lesson list
- Toggle complete/uncomplete button
- Keyboard shortcuts (←/→)
- Persist progress ke Supabase
- Progress calculation per course

### Phase 8 — Assignments
- Assignment store
- Assignment list + search + filters
- Assignment detail
- Countdown timer display
- Character counter on textarea
- Submission form (text + URL)
- Update submission
- Status labels
- Grade & feedback display

### Phase 9 — Instructor Module
- Instructor dashboard layout (`layouts/instructor.vue`)
- Sidebar navigasi instruktur
- Daftar MK yang diampu
- Detail MK + daftar mahasiswa terdaftar
- CRUD materi (create, read, update, delete)
- CRUD tugas (create, read, update, delete)
- Lihat submission mahasiswa + beri nilai & feedback
- Loading, empty, error states

### Phase 10 — Admin Module
- Admin dashboard layout (`layouts/admin.vue`)
- Sidebar navigasi admin
- Dashboard admin (total mahasiswa, instruktur, MK, tugas)
- CRUD Mahasiswa (tambah, edit, hapus, lihat)
- CRUD Instruktur (tambah, edit, hapus, lihat)
- CRUD Mata Kuliah (tambah, edit, hapus, lihat)
- Lihat seluruh assignments
- Loading, empty, error states

### Phase 11 — Profile, AI Chat & Calendar
- Student profile page (nama, NPM, avatar)
- Instructor profile page (nama, email, avatar)
- Admin profile page
- Edit form with validation
- Update ke database
- AI Chat assistant (integration with AI API)
- Code playground with Pyodide (Python execution)
- Kalender akademik (tabel academic_events, calendar store, 3 tampilan: list, bulan, timeline horizontal)
- Success & error messages

### Phase 12 — Testing & Deployment
- Vitest setup (99+ tests)
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

### Phase 13 — Attendance & Direct Grading
- Tabel `attendance` di database (foreign keys, unique constraint, indexes, CHECK constraint status)
- Attendance store (demo data + Supabase integration)
- CRUD presensi per pertemuan (instructor): `app/pages/instructor/courses/[id]/attendance/index.vue`
- Rekap presensi lintas MK (instructor): `app/pages/instructor/attendance/index.vue`
- Rekap presensi mahasiswa: `app/pages/student/attendance/index.vue`
- Persentase kehadiran per MK (dengan ring warna)
- Nav link "Presensi" di semua layout (dashboard, instructor, admin)
- Direct grading (`directGradeStudent` action): beri nilai ke semua mahasiswa sekaligus
- Tombol "Nilai Semua" pada halaman tugas instruktur dengan grid nilai+feedback inline
- Halaman hasil penilaian mahasiswa: `app/pages/student/grades/index.vue`
- Nav link "Nilai" di layout dashboard mahasiswa
