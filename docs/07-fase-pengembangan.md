# Bagian 7: Fase Pengembangan (11 Fase)

| Fase | Nama | Fokus Utama | Output |
|------|------|-------------|--------|
| 1 | **Project Setup** | Nuxt 4, TypeScript, Pinia, ESLint, CSS | Project running, type-check & build OK |
| 2 | **Landing Page & Auth UI** | Landing, Login role-based, Demo mode | Landing & login (Nama+NPM) |
| 3 | **Supabase Database** | SQL schema, RLS, seed (3 instruktur, 4 level) | schema.sql, policies.sql, seed.sql |
| 4 | **Supabase Auth & Routing** | Auth store, Middleware, Route structure | Login + routing per role |
| 5 | **Student Dashboard** | Layout, Sidebar, Stats, Announcements | Dashboard mahasiswa responsif |
| 6 | **Courses** | Course list, detail, search, level & session filter | Mahasiswa lihat MK & materi |
| 7 | **Lesson Progress** | Lesson detail, mark complete | Progress tersimpan di DB |
| 8 | **Assignments** | List, filter, submission, grade | Mahasiswa kumpul tugas |
| 9 | **Instructor Module** | Dashboard, manage courses, lessons, assignments | Instruktur kelola MK |
| 10 | **Profile** | Profile page, edit form (student + instructor) | Mahasiswa & instruktur update profil |
| 11 | **Testing & a11y** | Vitest, Playwright, a11y | Core flow lulus test |
| 12 | **Deployment** | Vercel, README, smoke test | Aplikasi live di Vercel |

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
- Mark as complete button
- Persist progress ke Supabase
- Progress calculation per course

### Phase 8 — Assignments
- Assignment store
- Assignment list + search + filters
- Assignment detail
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

### Phase 10 — Profile
- Student profile page (nama, NPM, program studi, avatar, bio)
- Instructor profile page (nama, email, avatar, bio)
- Edit form
- Validation
- Update ke database
- Success & error messages

### Phase 11 — Testing & Accessibility
- Vitest setup
- Unit tests (stores, utils)
- Component tests (cards, forms, states)
- Playwright E2E (student + instructor flows)
- Keyboard nav verification
- Contrast & label review

### Phase 12 — Deployment
- Push ke GitHub
- Import ke Vercel
- Environment variables
- Production build
- Smoke test
- README update
- Screenshot
