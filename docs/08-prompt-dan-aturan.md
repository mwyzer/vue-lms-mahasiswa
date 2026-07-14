# Bagian 8: Prompt & Aturan

## Aturan Vibe Coding (§25)

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

---

## Master Prompt Vibe Coding (§26)
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

---

## Prompt per Fase (§27)

### Phase 1 — Project Setup
```
Read PRD.md and implement Phase 1 only.
Set up Nuxt 4, TypeScript, Pinia, Supabase client, layouts, global CSS, env example, ESLint, Prettier.
Do not implement application features yet.
Run type-check and production build after implementation.
```

### Phase 2 — Landing Page & Auth UI
```
Read PRD.md and docs/09-routing-dan-autentikasi.md. Implement Phase 2 only.
Create landing page, login page with role selection (Mahasiswa/Instruktur).
Login is Nama + NPM based: student picks level → session → name from roster.
Instructor picks name from instructor list.
Do not connect real Supabase yet. UI must be responsive and accessible.
```

### Phase 3 — Supabase Database
```
Read PRD.md and implement Phase 3 only.
Create supabase/schema.sql, policies.sql, seed.sql.
Include all tables, FKs, indexes, constraints, profile trigger, RLS, student policies.
Seed 3 instructors (real names), students per level+session, courses for morning & evening.
Do not disable RLS. Explain SQL execution order.
```

### Phase 4 — Supabase Auth & Routing
```
Read PRD.md and docs/09-routing-dan-autentikasi.md. Implement Phase 4 only.
Connect Supabase Auth: plugin, Pinia store with loginAsStudent/loginAsInstructor.
Implement auth, guest, student, and instructor middleware.
Set up route structure: /dashboard and /* for students, /instructor/* for instructors.
Redirect to role-specific dashboard after login. Demo mode fallback.
```

### Phase 5 — Student Dashboard
```
Read PRD.md and docs/09-routing-dan-autentikasi.md. Implement Phase 5 only.
Build student dashboard: layout with sidebar, header (nama + NPM), mobile menu, stat cards, recent courses, upcoming assignments, announcements, loading skeleton, empty/error states.
Use demo data when Supabase unavailable.
```

### Phase 6 — Courses
```
Read PRD.md and implement Phase 6 only.
Build courses: Pinia store, list, search, cards, detail page, lesson list, progress, states.
Use Supabase when configured, demo data otherwise.
```

### Phase 7 — Lesson Progress
```
Read PRD.md and implement Phase 7 only.
Build lesson detail: prev/next nav, mark complete, persist progress, calculate progress, preserve demo mode.
Respect all RLS policies.
```

### Phase 8 — Assignments
```
Read PRD.md and implement Phase 8 only.
Build assignments: Pinia store, list, search/filter, detail, submission form, update, status, grade/feedback.
Students only access own submissions.
```

### Phase 9 — Instructor Module
```
Read PRD.md and docs/09-routing-dan-autentikasi.md. Implement Phase 9 only.
Build instructor module: dashboard, course management, lesson CRUD, assignment CRUD, view submissions, grade & feedback.
All under /instructor/* routes. Respect RLS policies.
```

### Phase 10 — Profile
```
Read PRD.md and implement Phase 10 only.
Build profile for both students and instructors: page, edit form, validation, avatar preview, Supabase update, loading/success/error states.
Students only update own profile. Instructors only update own profile.
```

### Phase 10 — Testing & Accessibility
```
Read PRD.md and implement Phase 10 only.
Add Vitest, Vue Test Utils, Playwright. Write unit, component, and E2E tests.
Improve accessibility and keyboard navigation.
Do not rewrite stable features unless needed.
```

### Phase 11 — Deployment
```
Read PRD.md and implement Phase 11 only.
Prepare for Vercel: review env vars, build scripts, production build, deployment instructions, update README, smoke test routes.
Do not add new features.
```

---

## Prompt Khusus

### Bug Fix Prompt (§28)
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

### Code Review Prompt (§29)
```
Review the Nuxt LMS codebase against PRD.md.
Check: architecture, TypeScript, Pinia, components, Supabase security, RLS, auth flow, error handling, states, responsive design, a11y, performance, test coverage, Vercel compatibility.
Return: critical, security, functional, quality, a11y, performance issues + recommended fix order.
```

### Refactoring Prompt (§30)
```
Refactor the selected LMS module without changing behavior.
Goals: reduce duplication, improve types, simplify components, move logic to composables, improve stores & error handling.
Preserve Supabase integration, demo mode, and UI behavior.
Run type-check and production build after.
```

---

## README Minimum (§31)
README harus berisi:
1. Deskripsi aplikasi
2. Screenshot
3. Fitur
4. Stack teknologi
5. Requirement
6. Cara instalasi
7. Environment variables
8. Cara menjalankan SQL
9. Cara membuat akun mahasiswa
10. Cara menjalankan demo mode
11. Cara menjalankan testing
12. Cara build
13. Cara deploy ke Vercel
14. Struktur folder
15. Security notes
16. Roadmap
