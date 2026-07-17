# Bagian 9: Routing & Autentikasi

## Metode Login

Login menggunakan **Nama + NPM** (untuk mahasiswa) atau **Nama** (untuk instruktur), bukan email/password. Data login bersumber dari daftar kelas yang sudah di-seed ke database.

### Alur Login Mahasiswa

```
Landing Page → /login
    → Pilih role: "Mahasiswa"
    → Pilih Level Kelas (1–4)
    → Pilih Waktu (Pagi / Malam)
    → Lihat daftar mahasiswa di kelas tersebut
    → Klik nama & NPM sendiri
    → Redirect ke /dashboard
```

### Alur Login Instruktur

```
Landing Page → /login
    → Pilih role: "Instruktur"
    → Lihat daftar 3 instruktur
    → Klik nama sendiri
    → Redirect ke /instructor/dashboard
```

### Demo Mode
- Data mahasiswa & instruktur diambil dari seed data lokal
- Tidak perlu koneksi Supabase
- Banner "Demo Mode" tetap ditampilkan

### Production (Supabase)
- Data login tetap dari tabel `profiles` (role = 'mahasiswa' / 'instruktur' / 'admin')
- Autentikasi diverifikasi melalui Supabase Auth + session
- RLS memastikan mahasiswa hanya bisa login sebagai dirinya sendiri

---

## Route Structure

### Public Routes
| Route | Halaman | Middleware |
|-------|---------|-----------|
| `/` | Landing Page | — |
| `/login` | Login (pilih role & identitas) | `guest` |

### Student Routes (Mahasiswa)
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

### Instructor Routes (Instruktur)
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

### Admin Routes
| Route | Halaman | Middleware |
|-------|---------|-----------|
| `/admin/dashboard` | Dashboard admin | `auth` + role check |
| `/admin/students` | CRUD Mahasiswa | `auth` |
| `/admin/instructors` | CRUD Instruktur | `auth` |
| `/admin/courses` | CRUD Mata Kuliah | `auth` |
| `/admin/assignments` | Semua tugas | `auth` |
| `/admin/profile` | Profil admin | `auth` |
| `/calendar` | Kalender akademik | `auth` |
| `/instructor/attendance` | Rekap presensi | `auth` |

---

## Struktur Folder Pages

```
pages/
├── index.vue                    # Landing page (publik)
├── login.vue                    # Login pilih role & identitas
│
├── dashboard.vue                # Student dashboard
├── courses/
│   ├── index.vue                # Student course list
│   └── [id].vue                 # Student course detail
├── courses/[courseId]/
│   └── lessons/
│       └── [lessonId].vue       # Student lesson detail
├── assignments/
│   ├── index.vue                # Student assignment list
│   └── [id].vue                 # Student assignment detail
├── profile.vue                  # Student profile
├── calendar/
│   └── index.vue                # Kalender akademik (list/month/timeline)
├── student/
│   ├── attendance/
│   │   └── index.vue            # Presensi mahasiswa
│   └── grades/
│       └── index.vue            # Hasil penilaian tugas
│
└── instructor/
    ├── dashboard.vue            # Instructor dashboard
    ├── courses/
    │   ├── index.vue            # Instructor course list
    │   └── [id].vue             # Instructor course detail
    ├── attendance/
    │   └── index.vue            # Rekap presensi semua MK
    ├── courses/[courseId]/
    │   ├── lessons/
    │   │   ├── index.vue        # Lesson list (manage)
    │   │   ├── create.vue       # Create lesson
    │   │   └── [lessonId].vue   # View lesson
    │   ├── assignments/
    │   │   ├── index.vue        # Assignment list (manage)
    │   │   ├── create.vue       # Create assignment
    │   │   └── [assignmentId].vue # View submissions
    │   └── attendance/
    │       └── index.vue        # Presensi per pertemuan
    └── profile.vue              # Instructor profile
```

---

## Middleware

### `auth` Middleware
- Cek apakah user sudah login (ada di store)
- Jika belum → redirect ke `/login`
- Jika sudah → lanjut

### `guest` Middleware
- Cek apakah user sudah login
- Jika sudah → redirect ke role-specific dashboard:
  - role `mahasiswa` → `/dashboard`
  - role `instruktur` → `/instructor/dashboard`
  - role `admin` → `/admin/dashboard`
- Jika belum → lanjut

### `student` Middleware
- Cek apakah role adalah `mahasiswa`
- Jika bukan → redirect ke `/instructor/dashboard`
- Jika sudah → lanjut

### `instructor` Middleware
- Cek apakah role adalah `instruktur`
- Jika bukan → redirect ke `/dashboard`
- Jika sudah → lanjut

### `admin` Middleware
- Cek apakah role adalah `admin`
- Jika bukan → redirect ke `/dashboard`
- Jika sudah → lanjut

---

## Layout

### Student Layout (`layouts/dashboard.vue`)
- Sidebar navigasi mahasiswa
- Header dengan nama & avatar
- Menu: Dashboard, Mata Kuliah, Tugas, Nilai, Kuis & Ujian, Presensi, Kalender, AI Tutor, Python, Profil, Logout

### Instructor Layout (`layouts/instructor.vue`)
- Sidebar navigasi instruktur
- Header dengan nama & avatar
- Menu: Dashboard, Mata Kuliah, Tugas, Mahasiswa, Presensi, Kalender, AI Tutor, Python, Profil, Logout

### Admin Layout (`layouts/admin.vue`)
- Sidebar navigasi admin
- Header dengan nama & avatar
- Menu: Dashboard, Mata Kuliah, Tugas, Mahasiswa, Instruktur, Presensi, Kalender, AI Tutor, Python, Profil, Logout

### Default Layout (`layouts/default.vue`)
- Landing page
- Minimal header + footer

---

## Diagram Alur Routing

```
                           ┌──────────────┐
                           │   / (Landing) │
                           └──────┬───────┘
                                  │
                                  ▼
                           ┌──────────────┐
                    ┌──────│   /login     │──────┐
                    │      └──────────────┘      │
                    ▼                            ▼
          ┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
          │ Role: Mahasiswa  │        │ Role: Instruktur  │        │  Role: Admin     │
          │ Pilih kelas +    │        │ Pilih nama        │        │ Masukkan password│
          │ Pilih nama + NPM │        └────────┬─────────┘        └────────┬─────────┘
          └────────┬─────────┘                 │                           │
                   │                           │                           │
                   ▼                           ▼                           ▼
          ┌──────────────────┐        ┌──────────────────────┐     ┌──────────────────┐
          │  /dashboard      │        │  /instructor/dashboard│     │  /admin/dashboard │
          │  /courses/*      │        │  /instructor/courses/*│     │  /admin/students  │
          │  /assignments/*  │        │  /instructor/...      │     │  /admin/*         │
          │  /profile        │        │  /calendar            │     │  /calendar        │
          │  /calendar       │        │  /instructor/attendance│     │  /instructor/attendance│
          │  /student/attendance │    │  /instructor/profile  │     │  /admin/profile   │
          │  /student/grades   │    └──────────────────────┘     └──────────────────┘
          │  /ai/chat         │
          │  /playground      │
          └──────────────────┘
                   │                           │                           │
                   │          Logout            │                           │
                   └──────────┐   ┌────────────┘                           │
                              ▼   ▼                                        │
                        ┌──────────────┐                                   │
                        │   /login     │◄──────────────────────────────────┘
                        └──────────────┘
```
