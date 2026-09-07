# Guardrails

Aturan batas (guardrails) yang wajib dijaga selama pengembangan, deployment, dan penggunaan AI coding assistant pada proyek LMS Mahasiswa ini.

---

## 1. Keamanan & Kredensial

- Jangan pernah menyimpan atau meng-commit secrets ke repository:
  - `NUXT_AI_API_KEY`
  - `NUXT_PUBLIC_SUPABASE_KEY` (hanya `sb_publishable_*` yang aman konsumen, tetap jangan dianggap rahasia)
  - `SUPABASE_SERVICE_ROLE_KEY` atau `SERVICE_ROLE`
- File `.env` TIDAK boleh masuk git (sudah di-ignore via `.gitignore`).
- Gunakan `.env.example` sebagai template yang aman, dengan nilai placeholder.
- Jangan pernah menaruh service role key pada kode client — itu akan terserap ke bundle dan bisa dibaca siapa pun.
- Setiap key rahasia di Vercel dikelola lewat Environment Variables dashboard, bukan di kode.

## 2. Mode Demo vs Production (Supabase)

- Proyek mendukung dua mode data:
  - **Demo mode** (`NUXT_PUBLIC_DEMO_MODE=true`) — data lokal hardcoded, tanpa koneksi DB.
  - **Live mode** (`NUXT_PUBLIC_DEMO_MODE=false`) — data dari Supabase.
- Administrator dapat berpindah mode secara runtime melalui tombol di dashboard admin / sidebar (tersimpan di `localStorage: lms-demo-override`).
- Default `nuxt.config.ts` meng-hardcode `demoMode: 'true'`. Di Vercel, nilai ini TIDAK mengikuti `.env` lokal (`.env` tidak ikut di-deploy) — pastikan `NUXT_PUBLIC_DEMO_MODE` diset eksplisit di Environment Variables Vercel agar sesuai keinginan.
- Jangan memakai dummy data ketika Supabase aktif (live mode). Saat live, semua data harus dibaca/tulis ke Supabase.
- Jangan menonaktifkan Row Level Security (RLS) sebagai jalan pintas menyelesaikan error akses — perbaiki policy-nya.

## 3. Autentikasi & Peran

- Login admin/instruktur/mahasiswa memakai pola yang berbeda antara demo dan live:
  - **Demo**: validasi password terhadap `DEMO_*_PASSWORDS` (hardcoded).
  - **Live**: validasi via Supabase Auth (`signInWithPassword`) — PASTIKAN akun `auth.users` dibuat untuk email yang bersangkutan. Row `profiles` saja TIDAK cukup untuk login live.
- Kredensial demo yang terdokumentasi (jangan diubah tanpa update README & login page):
  - Admin: `Admin LMS` / `admin123`
  - Instruktur: `Dr. Andi Wijaya` / `instruktur123`
  - Mahasiswa: `Ahmad Fauzi` / `mahasiswa123`
- Endpoint `POST /api/auth/session` TIDAK melakukan verifikasi password (memercayai body dari client). Jangan menaruh logika otorisasi penting bergantung sepenuhnya pada endpoint ini tanpa pengecekan tambahan.
- Middleware `auth` / `admin` / `guest` harus tetap: tamu → `/login`, non-admin → dashboard sendiri.

## 4. Build & Deployment (Vercel)

- Proyek memakai `nitro.preset: 'vercel'`.
- Build Vercel akan GAGAL jika ada aset > 2 MiB yang masuk precache workbox/PWA. Guardrail saat ini:
  - `workbox.maximumFileSizeToCacheInBytes: 5 * 1024 * 1024` (di `nuxt.config.ts`).
  - Jangan menurunkan angka ini di bawah ukuran bundle terbesar; jika bundle membesar lagi, naikkan atau pecah chunk.
- Sebelum menyatakan suatu fase selesai: jalankan `npm run build` (atau deploy preview) dan pastikan sukses.
- PWA menggunakan `registerType: 'autoUpdate'` — setelah deploy, sesekali user butuh hard refresh (Ctrl+F5) jika UI lama masih muncul.
- Jangan menonaktifkan service worker/PWA untuk menyembunyikan masalah cache.

## 5. Database (Supabase)

- Setiap perubahan skema harus tercermin di folder `supabase/` (schema, setup, seed, policies, migration).
- Dua set data ada: demo (`is_demo = TRUE`, id pendek seperti `s1`, `i1`, `a1`) dan real (`is_demo = FALSE`, id UUID).
- Jangan menghapus akun/profil seed tanpa memperbarui SQL terkait.
- RLS: kebijakan harus konsisten antara `setup.sql` (permissive default) dan `policies.sql` (restrictive). Pilih salah satu dan selaraskan — jangan campur.

## 6. Kualitas Kode

- `strict: true` pada TypeScript; hindari `any` kecuali benar-benar diperlukan.
- Gunakan `<script setup lang="ts">` dan Composition API.
- State global hanya di Pinia; logika reusable di composables; halaman tetap ramping.
- Selalu sediakan state: loading, empty, error, success.
- Jangan lanjut ke fitur baru jika build gagal; perbaiki error lebih dulu.

## 7. Perubahan oleh AI Coding Assistant

- Baca `docs/08-prompt-dan-aturan.md` dan PRD sebelum mengubah apa pun.
- Kerjakan satu fase dalam satu waktu; jangan menyentuh fitur di luar fase aktif.
- Jelaskan setiap file yang dibuat/diubah.
- Jangan menghapus file tanpa alasan jelas.
- Update README setelah fitur utama selesai.