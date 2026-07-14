# Bagian 3: Teknologi & Arsitektur

## Stack Teknologi (§9)

### Frontend
| Teknologi | Keterangan |
|-----------|------------|
| Nuxt 4 | Framework full-stack |
| Vue 3 | UI framework |
| TypeScript | Type safety |
| Composition API | Pattern komponen |
| Pinia | State management |
| Nuxt Router | Routing |
| Tailwind CSS | Styling |

### Backend
| Teknologi | Keterangan |
|-----------|------------|
| Supabase Auth | Autentikasi |
| Supabase PostgreSQL | Database |
| Supabase Data API | REST API |
| Supabase Storage | File storage |
| Row Level Security | Otorisasi |

### Development Tools
VS Code, Node.js 22+, npm, Git, GitHub, ESLint, Prettier, Vue DevTools, Supabase Dashboard

### Deployment
- Frontend: Vercel
- Database: Supabase
- Repository: GitHub

---

## Arsitektur Sistem (§10)
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

---

## Struktur Folder (§11)
```
lms-mahasiswa/
├── app/
│   ├── assets/css/main.css
│   ├── components/{common,dashboard,courses,lessons,assignments,profile,instructor}/
│   ├── composables/{useAuth,useCourses,useAssignments,useNotification}.ts
│   ├── layouts/{default,dashboard,instructor}.vue
│   ├── middleware/{auth,guest,student,instructor}.ts
│   ├── pages/
│   │   ├── index.vue                    # Landing page
│   │   ├── login.vue                    # Login role-based
│   │   ├── dashboard.vue                # Student dashboard
│   │   ├── courses/
│   │   │   ├── index.vue                # Student course list
│   │   │   ├── [id].vue                 # Student course detail
│   │   │   └── [courseId]/lessons/[lessonId].vue
│   │   ├── assignments/
│   │   │   ├── index.vue
│   │   │   └── [id].vue
│   │   ├── profile.vue                  # Student profile
│   │   └── instructor/
│   │       ├── dashboard.vue
│   │       ├── courses/
│   │       │   ├── index.vue
│   │       │   ├── [id].vue
│   │       │   ├── [courseId]/lessons/{index,create,[lessonId],[lessonId]/edit}.vue
│   │       │   └── [courseId]/assignments/{index,create,[assignmentId]}.vue
│   │       ├── profile.vue
│   │       └── ...
│   ├── plugins/supabase.client.ts
│   ├── stores/{auth,courses,assignments,ui}.ts
│   ├── types/{database,course,assignment,roster}.ts
│   └── app.vue
├── public/
├── supabase/{schema,policies,seed}.sql
├── docs/{01..09}/*.md
├── .env.example
├── nuxt.config.ts
├── package.json
└── README.md
```

---

## Environment Variables (§16)
```env
NUXT_PUBLIC_SUPABASE_URL=
NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Ketentuan:
- Publishable key boleh digunakan pada client
- RLS wajib aktif
- Secret key & service role key tidak boleh masuk frontend/repository
- `.env` wajib masuk `.gitignore`

---

## Performance Targets (§19)
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

---

## Security Requirements (§21)
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
