# Bagian 13: Fitur Prioritas 3

## W2 — Progres & gamifikasi, sertifikat, pencarian global

Tiga fitur untuk mahasiswa (pencarian global juga untuk instruktur dan admin). Semuanya berjalan dalam mode demo tanpa konfigurasi. Ini sistem demo: aturan badge dan penerbitan sertifikat dinilai di klien dan tidak di-hardening.

### Setup produksi

1. Jalankan `supabase/migration-prioritas-3-w2.sql` di SQL Editor Supabase, **setelah** `migration-prioritas-1.sql` (butuh `current_profile_id()`, `is_course_staff()`, dan tabel `notifications`). Skrip ini idempoten dan membuat:
   - `user_activity`: log aktivitas belajar. Pemilik bisa baca/tulis/hapus barisnya sendiri; staf mata kuliah bisa membaca.
   - `user_badges`: badge yang sudah didapat, unik per `(user_id, badge_id)`. Semua user login boleh membaca, hanya pemilik yang boleh insert, tidak ada update/delete. Trigger `notify_badge_earned` membuat baris `notifications` (tipe `sistem`) untuk setiap badge baru, sehingga muncul lewat Realtime yang sudah ada.
   - `certificates`: satu sertifikat per `(user_id, course_id)` dengan `verification_code` unik. Mahasiswa hanya boleh insert untuk mata kuliah yang ia ikuti. Pemilik dan staf mata kuliah boleh membaca.
   - `verify_certificate(code)`: fungsi `SECURITY DEFINER` untuk verifikasi kode (mengembalikan nama, mata kuliah, tanggal). Belum ada halaman verifikasi yang memakainya.
2. Pencarian server (`GET /api/search`) memakai `SUPABASE_SERVICE_ROLE_KEY` yang sama dengan Prioritas 2. Tanpa key itu, endpoint menjawab 503 dan klien mencari dari data store-nya sendiri.
3. Dependency baru: `pdf-lib` (sertifikat PDF). Library ini di-import dinamis, jadi baru diunduh saat tombol unduh ditekan.

### 1. Progres & gamifikasi (`/student/progress`)

- **UI:**
  - Halaman `/student/progress` berisi streak harian, heatmap 28 hari, penghitung aktivitas, grid badge (yang terkunci menampilkan progresnya), progres per mata kuliah (materi, kuis aktif yang sudah dikerjakan, tugas terkumpul), tombol sertifikat, dan 10 aktivitas terakhir.
  - Widget **Progres Belajar** di `/dashboard` menampilkan streak, jumlah badge, streak terpanjang, mata kuliah tuntas, badge terbaru, dan badge berikutnya beserta progresnya.
  - Isi halaman dan widget dirender di klien saja (`<ClientOnly>`), karena datanya per user (localStorage/Supabase). Tujuannya juga menghindari hydration mismatch.
- **Aktivitas** yang dihitung: `lesson_completed`, `quiz_submitted`, `assignment_submitted`, `flashcard_reviewed`, `forum_post`. Sumbernya ada dua, lalu digabung (duplikat per tipe+ref dihitung sekali, kuis memakai skor terbaik):
  1. **diturunkan** dari store lain: `lesson_progress.completed_at`, `quiz_attempts`, submission milik mahasiswa, serta thread dan balasan forum yang ia tulis;
  2. **log eksplisit** `progress.record(...)`. Store `progress` memasang `$onAction` pada `courses.markLessonCompleted/toggleLessonCompleted`, `quiz.submitQuiz`, `assignments.submitAssignment`, dan `forum.createThread/addReply`, jadi setiap kejadian ikut tercatat tanpa mengubah store tersebut. Log disimpan di localStorage (`lms-progress-v1:<userId>`, demo) atau tabel `user_activity` (produksi).
- **Flashcard:** fitur flashcard (worker lain) cukup memanggil `useProgressStore().record('flashcard_reviewed', deckId, courseId, { count })`. `meta.count` dijumlahkan untuk badge "Ahli Flashcard".
- **Streak:** dihitung per hari kalender WIB (UTC+7), tidak bergantung zona waktu browser. Streak saat ini tetap "hidup" sampai akhir hari setelah hari aktif terakhir. Aktivitas bertanggal di masa depan dianggap hari ini.
- **Badge:** definisinya ada di `app/data/badges.ts`. Aturannya `stats[metric] >= min`, dengan metrik dari `computeStats`. Badge streak memakai *streak terpanjang*, jadi tidak hilang saat streak putus. Badge tidak pernah dicabut. Jangan mengganti `id` badge yang sudah ada, karena nilainya tersimpan di `user_badges.badge_id`.

  | id | Nama | Syarat |
  |---|---|---|
  | `pemula` | Pemula | 1 aktivitas |
  | `streak-3` / `streak-7` / `streak-30` | Konsisten / Streak 7 Hari / Streak 30 Hari | streak terpanjang 3 / 7 / 30 hari |
  | `kutu-buku` | Kutu Buku | 10 materi selesai |
  | `nilai-sempurna` | Nilai Sempurna | 1 kuis bernilai 100 |
  | `pejuang-kuis` | Pejuang Kuis | 5 kuis dikerjakan |
  | `tepat-waktu` | Rajin Tugas | 3 tugas dikumpulkan |
  | `rajin-forum` | Rajin Forum | 5 thread/balasan forum |
  | `pengulang` | Ahli Flashcard | 50 flashcard direview |
  | `tuntas` | Tuntas | 1 mata kuliah selesai 100% |
- **Notifikasi badge:** di mode demo lewat aksi baru `notifications.notifySelf()` (`notifyUsers` sengaja melewati pelaku), dengan `dedupe_key` `badge:<id>`, ditambah satu toast. Di produksi klien hanya melakukan `upsert` ke `user_badges`, lalu trigger DB membuat notifikasinya.
- **Data demo:** mahasiswa `s1` dan `s2` mendapat seed review flashcard 5 dan 2 hari ke belakang (hanya di demo, saat belum ada data tersimpan). Dengan materi demo yang selesai "hari ini", Ahmad Fauzi (`s1`) langsung punya streak 6 hari dan badge Pemula, Konsisten, serta Nilai Sempurna.
- **Kode:**
  - `app/lib/progress.ts`: fungsi murni `dayKey`, `computeStreak`, `computeStats`, `evaluateBadges`, `badgeProgress`, `activityHeatmap`.
  - `app/stores/progress.ts`, `app/data/badges.ts`.
  - `app/components/progress/{ProgressSummaryWidget,BadgeGrid,StreakHeatmap}.vue`, `app/pages/student/progress/index.vue`.
  - Getter baru di store `courses`: `lessonsByCourse(courseId)` dan `lessonProgressFor(studentId)`.

### 2. Sertifikat PDF

- Saat semua materi sebuah mata kuliah selesai (progres 100%), store menerbitkan catatan sertifikat:
  - `issued_at` diambil dari waktu materi terakhir diselesaikan;
  - kode verifikasi berformat `LMS-XXXX-XXXX-XXXX`, deterministik dari mahasiswa + mata kuliah + tanggal terbit (hash FNV, bukan tanda tangan kriptografis).

  Mahasiswa juga mendapat notifikasi "Sertifikat siap". Sertifikat yang sudah terbit tetap bisa diunduh walaupun progres demo ter-reset saat halaman dimuat ulang.
- Tombol **⬇️ Unduh Sertifikat** ada di kartu mata kuliah di `/student/progress`. PDF dibuat di browser dengan `pdf-lib`:
  - A4 landscape, hanya font standar (Times/Helvetica), tanpa logo atau merek pihak lain;
  - berisi nama aplikasi (`runtimeConfig.public.appName`), nama dan NPM mahasiswa, kode dan nama mata kuliah, tanggal terbit (WIB), dan kode verifikasi;
  - karakter di luar WinAnsi (mis. emoji atau aksara non-Latin) dibuang dari teks PDF.
- **Kode:** `app/lib/certificate.ts` (`makeVerificationCode`, `buildCertificatePdf`, `downloadPdf`), `progress.downloadCertificate()`.

### 3. Pencarian global (Ctrl/Cmd+K)

- **UI:**
  - Komponen `GlobalSearch` ada di topbar layout mahasiswa, instruktur, dan admin. Di mobile tampil sebagai tombol ikon, dan dialognya layar penuh.
  - Pintasan Ctrl+K / ⌘K membuka dan menutup palet. Navigasi: ↑/↓/Home/End untuk memilih, Enter untuk membuka, Esc untuk menutup. Fokus kembali ke elemen sebelumnya setelah palet ditutup.
  - Pola ARIA yang dipakai: combobox, listbox, dan `aria-activedescendant`.
  - Hasil dikelompokkan: Perintah & Halaman, Mata Kuliah, Materi, Kuis, Tugas, Forum (maks. 5 per grup). Query kosong menampilkan daftar perintah, termasuk "Ganti tema terang/gelap".
- **Hak lihat:** indeks hanya berisi mata kuliah yang boleh dilihat role tersebut:
  - mahasiswa: mata kuliah yang diikuti;
  - instruktur: mata kuliah yang diampu;
  - admin: semua mata kuliah.

  Materi, kuis, tugas, dan thread di luar mata kuliah itu dibuang, dan mahasiswa hanya melihat kuis aktif. Tautan berbeda per role (mis. materi → `/courses/{c}/lessons/{l}` untuk mahasiswa, `/instructor/courses/{c}/lessons` untuk instruktur). Admin tidak mendapat hasil materi.
- **Ranking** (`app/lib/search.ts`, dipakai klien dan server): skor leksikal per token, diambil yang terbaik dari field judul, kata kunci, subjudul, dan isi (bobot 3 / 2 / 1,5 / 0,5).
  - Kekuatan kecocokan, dari yang tertinggi: kata persis, awalan kata, kata dasar + akhiran Indonesia (≤4 huruf, mis. "variabelnya"), substring, lalu salah ketik 1 huruf (judul/kata kunci saja).
  - Minimal 60% token query harus cocok. Ada bonus bila judul sama dengan query atau diawali query.
  - Skor ditambah 3 × kosinus `localEmbedding` dari `server/utils/aiText.ts`. Hasil tanpa kecocokan leksikal hanya masuk bila kosinusnya ≥ 0,45.
- **Mode:**
  - Demo, atau ketika server gagal: pencarian dilakukan di klien terhadap data store (label "Lokal · leksikal").
  - Supabase: `GET /api/search?q=` dengan cookie sesi (rate limit 60/menit per user). Server membaca data yang boleh dilihat memakai service role, lalu menambah skor materi dengan `match_lesson_chunks` (pola `retrieveFromPgvector` dari `rag.ts`).
    - Bila embedding API aktif dan ada potongan yang cocok, label menjadi "Server · semantik".
    - Bila pgvector gagal, hasilnya tetap leksikal.
    - Respons tidak menyertakan isi teks.
- **Kode:** `app/components/common/GlobalSearch.vue`, `app/composables/useGlobalSearch.ts`, `app/lib/search.ts`, `server/utils/globalSearch.ts`, `server/api/search.get.ts`.

### Tes

`app/test/lib/progress.test.ts` (streak, statistik, evaluasi badge), `app/test/lib/search.test.ts` (ranking, pengelompokan, hak lihat, rute per role), `app/test/lib/certificate.test.ts` (kode verifikasi, PDF dibaca ulang dengan pdf-lib), `app/test/stores/progress.test.ts` (store: aktivitas turunan, badge + notifikasi, `record`, hook `submitQuiz`/`markLessonCompleted`, persistensi, sertifikat), `app/test/server/globalSearch.test.ts` (server: hak lihat, boost pgvector, fallback).

### Batasan

- **Data demo tidak persisten:** progres materi, attempt kuis, dan submission demo hidup di memori dan ter-reset saat reload. Log aktivitas, badge, dan sertifikat di localStorage tetap tersimpan, sehingga setelah reload jumlah "materi selesai" bisa memuat materi yang progres demonya sudah hilang.
- **Bisa dimanipulasi:** badge, sertifikat, dan log aktivitas ditulis oleh klien, dan RLS hanya memastikan pemiliknya benar. Mahasiswa yang memanggil API langsung bisa memberi dirinya badge, atau sertifikat untuk mata kuliah yang ia ikuti. Untuk produksi sungguhan, evaluasi dan penerbitan perlu dipindah ke server/fungsi DB.
- **Kode verifikasi:** bukan tanda tangan digital. Keasliannya hanya bisa dicek lewat tabel `certificates` (`verify_certificate`).
- **Belum diuji terhadap backend nyata:** migrasi SQL dan jalur Supabase (`user_activity`, `user_badges`, `certificates`, `/api/search` dengan service role dan pgvector) belum dijalankan terhadap database sungguhan. Jalur ini hanya diuji dengan mock.
