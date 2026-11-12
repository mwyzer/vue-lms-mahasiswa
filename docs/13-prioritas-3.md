# Bagian 13: Fitur Prioritas 3

## W1 — Jalur belajar adaptif + Flashcard (spaced repetition)

Dua fitur belajar mandiri untuk mahasiswa. Keduanya berjalan penuh dalam mode demo (data in-memory) dan dalam mode Supabase.

### Setup produksi

1. Jalankan `supabase/migration-prioritas-3-w1.sql` di SQL Editor Supabase, **setelah** `migration-prioritas-1.sql` (memakai `public.current_profile_id()` dan `public.is_course_member()`). Skrip ini idempoten dan membuat:
   - tabel `flashcards`: kartu milik satu user, kolom SM-2 (`ease_factor`, `interval_days`, `repetitions`, `due_date`, `lapses`), `status` (`active`/`draft`), dan `source` (`manual`/`ai`/`demo`);
   - tabel `flashcard_reviews`: log setiap review, dipakai untuk statistik;
   - indeks antrian `(user_id, due_date) WHERE status = 'active'` dan indeks pendukung lain;
   - RLS: kartu dan log hanya bisa dibaca dan diubah pemiliknya. Kartu yang ditautkan ke mata kuliah hanya boleh untuk mata kuliah yang diikuti atau diampu.
2. Jalur belajar tidak butuh tabel baru. Ia membaca `quizzes`, `quiz_questions`, `quiz_attempts`, `lessons`, dan (bila ada) `quiz_answers` milik mahasiswa. Migrasi ini sengaja **tidak** mengubah RLS `quiz_answers`.
3. Tidak ada env baru. "Buat dengan AI" memakai `NUXT_AI_*` yang sama dengan Prioritas 2.

### 1. Jalur belajar adaptif — `/student/learning-path`

- **UI:**
  - satu tab per mata kuliah yang diikuti;
  - kartu ringkasan: skor rata-rata, jumlah topik lemah, dan jumlah kuis yang dihitung;
  - **Rekomendasi untukmu**: setiap topik lemah disertai tautan *Pelajari ulang* (materi), *Buat flashcard dari materi ini* (`/student/flashcards?lesson=…`), dan kuis latihan;
  - **Skor per topik** (bar berwarna, label "Lemah"/"estimasi");
  - **Materi yang belum teruji kuis**.

  Ambang topik lemah bisa dipilih: < 60, < 70 (bawaan), atau < 80.
- **Topik sebuah soal** (`app/utils/learningPath.ts`):
  1. Bila soal punya kolom `topik`/`tags`, itu yang dipakai. Skema saat ini belum punya kolom ini; dukungan ini disiapkan untuk ke depan.
  2. Bila tidak, dipilih materi yang paling cocok di mata kuliah yang sama. Pencocokan memakai kata dari soal + teks jawaban benar, dengan bobot IDF: kata di judul materi ×3, kata di isi materi ×1. Kata-kata nama mata kuliah (mis. "pemrograman" di "Pemrograman Dasar") diabaikan. Skor di bawah 1,2 berarti soal masuk ke topik **"Umum (belum terpetakan ke materi)"**.
- **Skor topik:**
  - Hanya percobaan **terakhir** per kuis yang dihitung.
  - Benar/salah per soal diambil dari `quiz_answers` bila ada. Jawaban yang lebih tua dari percobaan terakhir diabaikan.
  - Bila tidak ada, skor **diestimasi** dari persentase percobaan, dibagi rata ke setiap soal kuis itu. UI menandainya "estimasi". Ini perlu dicatat karena `quizStore.submitQuiz` saat ini hanya menyimpan skor per percobaan, tidak per soal, jadi kuis yang dikerjakan di aplikasi selalu menghasilkan estimasi.
- **Rekomendasi kuis latihan:** kuis aktif di mata kuliah yang sama yang memuat soal bertopik itu. Kuis yang belum dicoba diurutkan lebih dulu, lalu yang nilai terakhirnya paling rendah.
- **Data demo:** `DEMO_QUIZ_ANSWERS` di `app/composables/useLearningPath.ts` konsisten dengan percobaan demo di `stores/quiz.ts`. Ahmad Fauzi (s1) salah di soal do-while, sehingga topik **Perulangan (Looping)** muncul sebagai topik lemah, dengan rekomendasi materi l4 dan kuis qz1.
- **Kode:** `app/utils/learningPath.ts` (logika murni), `app/composables/useLearningPath.ts`, `app/pages/student/learning-path.vue`.

### 2. Flashcard + spaced repetition — `/student/flashcards`

- **Tab Review:** antrian kartu yang jatuh tempo hari ini atau terlambat. Urutannya: yang paling terlambat dulu, lalu kartu yang pernah direview, lalu kartu baru. Antrian dibekukan saat sesi dimulai.
  - Klik kartu atau tekan Spasi untuk membalik.
  - Tombol penilaian **Lagi / Sulit / Bagus / Mudah** = kualitas SM-2 1 / 3 / 4 / 5 (pintasan keyboard 1–4). Setiap tombol menampilkan pratinjau interval berikutnya.
  - Centang **Mode 0–5** untuk menilai langsung dengan kualitas 0–5 (pintasan 0–5).
- **Tab Kartu Saya:** buat kartu manual (depan maks. 300 karakter, belakang maks. 800, mata kuliah/materi opsional), lalu edit atau hapus. Kartu baru langsung jatuh tempo hari ini.
- **Tab Buat dengan AI:**
  1. Pilih materi dan jumlah kartu (1–20), lalu tekan **✨ Buat dengan AI**. Kartu yang dihasilkan menjadi **draf** (status `draft`, label "draft") dan **belum disimpan**.
  2. Draf bisa diedit, dihapus centangnya, dibuang, atau dibuat ulang.
  3. **Simpan N kartu** hanya menyimpan draf yang dicentang. Draf yang sisi depannya sudah ada di koleksi dilewati.
- **Tab Statistik:**
  - total kartu, jatuh tempo, akurasi hari ini (kualitas ≥ 3 dihitung benar), dan streak hari review;
  - jumlah kartu baru / sedang dipelajari / matang (interval ≥ 21 hari);
  - rata-rata ease factor dan total lapses;
  - perkiraan beban review 7 hari.
- **Algoritma SM-2** (`app/utils/sm2.ts`):
  - **q ≥ 3:** interval 1 → 6 → round(interval × EF), dan `repetitions` bertambah 1.
  - **q < 3:** `repetitions` = 0, interval 1 hari, dan `lapses` bertambah 1.
  - **EF** diperbarui di setiap review: EF' = EF + (0,1 − (5−q)(0,08 + (5−q)·0,02)), dengan batas bawah 1,3.
  - Interval dibatasi maksimal 3650 hari.
  - `due_date` disimpan sebagai tanggal kalender lokal (`YYYY-MM-DD`).
- **Mode demo:** kartu contoh untuk s1/s2 dengan tanggal jatuh tempo relatif terhadap hari ini. Semua perubahan hanya disimpan di memori dan hilang saat halaman dimuat ulang.
- **Kode:** `app/utils/sm2.ts`, `app/stores/flashcards.ts`, `app/types/flashcard.ts`, `app/components/flashcards/FlashcardReviewSession.vue`, `app/components/flashcards/FlashcardAiGenerator.vue`, `app/pages/student/flashcards.vue`.

### Kontrak endpoint

| Endpoint | Role | Request | Response |
|---|---|---|---|
| `POST /api/ai/generate-flashcards` | semua user login (student/instructor/admin) | `{ lesson: { judul?, konten }, count?: 1–20 (bawaan 8), existing?: string[] (sisi depan yang sudah ada, maks. 500), seed? }`. Konten 80–50.000 karakter (12.000 karakter pertama masuk prompt), body maks. 256 KB | `{ cards: { front, back }[], source: 'ai'\|'demo', requested, generated }`. Tidak menyimpan apa pun |

- Galat: 400 input tidak valid, 401 belum login, 413 body terlalu besar, 422 materi tidak menghasilkan kartu, 429 rate limit atau anggaran harian (dari middleware dan `costTracker` yang sama dengan Prioritas 2).
- **Mode AI:** JSON mode lewat `chatJsonWith`. Materi dan daftar kartu yang sudah ada dibungkus `wrapUntrusted` dan disertai `UNTRUSTED_NOTICE`. Balasan model divalidasi ketat: depan/belakang wajib ada, ada batas panjang, depan ≠ belakang, dan tidak boleh duplikat (termasuk terhadap `existing`).
- **Mode demo / AI gagal:** kartu deterministik dari teks materi:
  - kartu definisi dari kalimat "X adalah/merupakan/disebut/digunakan untuk … Y";
  - kartu isian rumpang ("Lengkapi: … _____ …") pada istilah yang muncul ≥ 2 kali.

  UI memberi label "contoh (mode demo)". Kualitasnya terbatas.
- **Kode:** `server/api/ai/generate-flashcards.post.ts`, `server/utils/flashcardGen.ts`.

### Tes

- `app/test/utils/sm2.test.ts`: interval, EF, lapse, tanggal, dan validasi kualitas.
- `app/test/utils/learningPath.test.ts`: pemetaan topik, skor exact vs. estimasi, percobaan terakhir, rekomendasi, dan integrasi dengan store demo.
- `app/test/stores/flashcards.test.ts`: CRUD, review SM-2, antrian, draf AI (`$fetch` di-mock), statistik, dan smoke test mode Supabase dengan klien mock.
- `app/test/server/flashcardGen.test.ts`: parsing, prompt, validasi, fallback demo, dan jalur AI dengan fetch mock.

### Batasan / belum diuji

- **Supabase sungguhan belum diuji.** Migrasi dan query `flashcards`/`flashcard_reviews` hanya diuji dengan klien mock.
- **Panggilan AI sungguhan belum diuji.** Jalur kunci API hanya diuji dengan fetch mock.
- **Skor per soal belum tersedia untuk kuis yang dikerjakan di aplikasi.** Skor topik dari kuis baru selalu berupa estimasi sampai `submitQuiz` menyimpan jawaban per soal ke `quiz_answers` (di luar cakupan W1).
- **Pemetaan soal ke materi bersifat leksikal.** Soal yang memakai istilah berbeda dari materi bisa jatuh ke "Umum".
- **Mode demo tidak persisten:** review dan kartu baru hilang saat halaman dimuat ulang.
- **Store flashcards belum ikut di-reset oleh tombol mode demo admin** (`ui.toggleDemoMode`), sama seperti store forum. Muat ulang halaman setelah mengganti mode.

## W4 — Mahasiswa berisiko + Impor/Ekspor

### Setup produksi

1. Jalankan `supabase/migration-prioritas-3-w4.sql` setelah `migration-prioritas-1.sql`. Skrip ini idempotent dan membuat:
   - tabel `risk_interventions`, log pengingat dan tindak lanjut. Hanya dosen pengampu dan admin yang bisa membaca dan menambah (`is_course_staff`). Hanya admin yang bisa menghapus, dan tidak ada UPDATE;
   - RPC `send_risk_reminder(...)` (SECURITY DEFINER). RPC ini memeriksa bahwa pemanggil adalah pengampu/admin dan mahasiswanya terdaftar, lalu menulis notifikasi dan intervensi. RPC dipakai karena klien tidak boleh INSERT langsung ke `notifications`;
   - tabel `import_jobs`, riwayat impor. Hanya service role yang menulis; user membaca miliknya sendiri, admin membaca semua.
2. Env yang dipakai sama dengan Prioritas 1/2: `SUPABASE_SERVICE_ROLE_KEY` (endpoint impor dan cron) dan `CRON_SECRET` (cron).
3. `vercel.json` sekarang punya cron kedua, `/api/cron/at-risk`, setiap Senin 01:00 UTC.

### 1. Dashboard mahasiswa berisiko

- **UI:**
  - `/instructor/at-risk` menampilkan hanya mata kuliah yang diampu, dengan filter per mata kuliah. `?course=<id>` memilih mata kuliah sejak awal; tautan dari notifikasi cron memakai ini.
  - `/admin/at-risk` mencakup semua mata kuliah, dengan filter kampus dan mata kuliah.
  - Keduanya memakai komponen `AtRiskDashboard.vue`. Filter tambahan: level, cari nama/NPM, dan "sembunyikan yang sudah ditindaklanjuti".
- **Tabel:** diurutkan dari skor tertinggi. Setiap baris menampilkan skor 0–100, level (rendah/sedang/tinggi), dan alasan utama. **Detail** membuka:
  - semua alasan beserta kontribusi poinnya;
  - rincian sinyal (nilai faktor × bobot);
  - cakupan data;
  - riwayat intervensi.
- **Aksi:**
  - **Kirim pengingat** — pesan bisa diedit (terisi otomatis dari alasan). Mahasiswa menerima notifikasi `sistem` berjudul "Pengingat dari dosen: …" dengan tautan ke mata kuliah. Demo: lewat `notificationsStore.notifyUsers`. Supabase: lewat RPC.
  - **Tandai sudah ditindaklanjuti** — catatan opsional. Status "✓ Ditindaklanjuti" berlaku sampai ada pengingat baru.
- **Skor** (`app/utils/riskScore.ts`, fungsi murni yang juga dipakai server). Enam sinyal masing-masing menjadi faktor 0–1, lalu dirata-rata berbobot:

  | Sinyal | Faktor = 1 bila | Bobot bawaan |
  |---|---|---|
  | Kehadiran (izin/sakit dihitung ½ hadir) | kehadiran ≤ 75%, naik linear dari 100% | 25 |
  | Tugas tidak dikumpulkan | semua tugas yang lewat tenggat tidak dikumpulkan (rasio) | 25 |
  | Tugas terlambat | semua pengumpulan melewati tenggat (rasio) | 10 |
  | Tren nilai turun (rata-rata paruh awal vs. paruh akhir nilai tugas + kuis, kronologis) | turun ≥ 20 poin (turun < 5 dianggap 0) | 15 |
  | Nilai rendah | rata-rata ≤ 30 (0 pada batas lulus 60) | 15 |
  | Tidak aktif (aktivitas terakhir: pengumpulan, kuis, hadir, materi selesai) | ≥ 28 hari (dilaporkan mulai 14 hari); tanpa aktivitas sama sekali = 1 | 10 |

  - **Data kosong:** sinyal tanpa data dilewati dan bobot sisanya dinormalkan ulang, seperti gradebook. Bila cakupan data < 50% bobot, baris diberi label "data terbatas".
  - **Level:** sedang ≥ 35, tinggi ≥ 60.
  - **Bobot bisa diatur** lewat tombol "⚙️ Bobot sinyal". Bobot disimpan di `localStorage` (`lms_risk_weights`) per browser, belum per mata kuliah. Ambang batas bisa diubah lewat parameter `thresholds` di fungsi, tetapi belum ada UI-nya.
- **Pendaftaran mahasiswa:** sama dengan gradebook, yaitu level + sesi mahasiswa = level + sesi mata kuliah.
- **Mode demo:** data contoh berasal dari 2025, jadi "sekarang" diganti tanggal aktivitas terakhir di data (`latestActivityTimestamp`, saat ini 2 Okt 2025). Tanggal acuan ini ditampilkan di halaman. Karena data demo jarang, banyak mahasiswa mendapat skor 100 hanya dari dua sinyal (berlabel "data terbatas").
- **Cron** `GET /api/cron/at-risk?min_level=tinggi|sedang`:
  - pengamannya sama dengan `deadline-reminders` (Bearer `CRON_SECRET`, 503 bila belum dikonfigurasi);
  - memakai bobot bawaan dan tabel `enrollments`;
  - mengirim satu notifikasi per mata kuliah ke dosen pengampu: "N mahasiswa berisiko tinggi di MKxxx", maks. 5 nama, dengan tautan ke dashboard;
  - dedupe per mata kuliah per hari: `at-risk:<course>:<YYYY-MM-DD>`.
- **Kode:**
  - `app/utils/riskScore.ts`, `app/stores/atRisk.ts`;
  - `app/components/atRisk/AtRiskDashboard.vue`;
  - `app/pages/instructor/at-risk/index.vue`, `app/pages/admin/at-risk.vue`;
  - `server/api/cron/at-risk.get.ts`.

### 2. Impor & ekspor

- **UI:** `/instructor/import-export` dan `/admin/import-export` (komponen `ImportExportPanel.vue`). Admin punya filter kampus untuk daftar mata kuliah dan ekspor daftar mahasiswa.
- **Impor mahasiswa (CSV):**
  1. **Unduh template.** Kolom `nama`*, `npm`*, `kelas`, `level` (1–5), `sesi` (pagi/sore, juga menerima morning/evening), dan `email`. Alias header juga dikenali: NIM, name, semester, dll.
  2. **Format file:** pemisah `,` atau `;` dideteksi otomatis, BOM dibuang. Field ber-kutip dan baris baru di dalam kutip didukung. Maks. 500 baris dan 2 MB.
  3. **Enroll ke mata kuliah (opsional).** Bila dipilih, `level`/`sesi` boleh kosong dan **diganti** dengan milik mata kuliah, disertai peringatan per baris. Kelas kosong diisi otomatis, mis. `1A` untuk pagi dan `1B` untuk sore.
  4. **Pratinjau.** Setiap baris diberi status valid / tidak valid / duplikat, beserta daftar error dan catatan dan nomor baris file:
     - validasi: nama wajib (tidak boleh diawali `=+-@`), NPM 4–20 huruf/angka, level 1–5, sesi, dan format email;
     - duplikat dideteksi terhadap roster (NPM/email) dan terhadap baris sebelumnya di file yang sama.
     - **Laporan error (CSV)** berisi baris yang ditolak beserta alasannya.
  5. **Impor N mahasiswa valid.** Hanya baris valid yang diimpor:
     - **Demo:** `authStore.addStudent`, ditambah ke roster lokal. Enroll berarti level/sesi mata kuliah.
     - **Supabase:** `POST /api/import/students` (service role) memvalidasi ulang dengan fungsi yang sama dan melewati NPM/email yang sudah ada. Endpoint lalu insert `profiles`, upsert `enrollments` bila ada mata kuliah, dan mencatat `import_jobs`.
     - **Pemeriksaan akses:** sesi instruktur/admin wajib, dan instruktur hanya boleh enroll ke mata kuliah yang ia ampu. Tanpa service key, endpoint menjawab 503.
     - **Akun login tidak dibuat.** Mahasiswa hasil impor belum punya akun Supabase Auth.
  6. Setelah impor, pratinjau dihitung ulang (baris yang baru masuk menjadi "duplikat") agar tidak terimpor dua kali. Riwayat impor ditampilkan di bawahnya.
- **Ekspor** (per mata kuliah):

  | Data | Format | Isi |
  |---|---|---|
  | Buku nilai | Excel, PDF, CSV | `gradebookStore.courseGradebook`: komponen + bobot, nilai akhir, huruf, status Final/Sementara. PDF berukuran A4 landscape, dengan catatan bobot dan skala huruf |
  | Presensi | CSV, Excel | Matriks P1..Pn (H/I/S/A) + total + % hadir |
  | Daftar mahasiswa | CSV, Excel | NPM, nama, kelas, level, sesi (+ kampus untuk admin). Admin bisa memilih "Semua mahasiswa" (mengikuti filter kampus) |

- **Keamanan file:**
  - CSV ditulis dalam UTF-8 **dengan BOM** dan baris CRLF.
  - Sel teks yang diawali `=`, `+`, `-`, `@`, tab, atau CR diberi awalan `'` (`sanitizeCsvCell`). Angka dan placeholder `-` tidak diubah.
  - Di XLSX, setiap sel teks dipaksa bertipe string tanpa formula, sehingga apostrof tidak diperlukan.
- **Dependency:**
  - `xlsx` sudah ada.
  - Baru: `jspdf` + `jspdf-autotable`, di-*import* dinamis hanya saat ekspor PDF.
  - Font standar PDF hanya mencakup Latin-1. Karakter di luarnya dibuang dan tanda pisah diganti ASCII (`pdfSafeText`).
- **Kode:**
  - `app/utils/csvTools.ts`, `app/utils/studentImport.ts`, `app/utils/exportFiles.ts`;
  - `app/stores/importJobs.ts`;
  - `app/components/importExport/ImportExportPanel.vue`;
  - `app/pages/instructor/import-export/index.vue`, `app/pages/admin/import-export.vue`;
  - `server/api/import/students.post.ts`.

### Tes

- `app/test/utils/riskScore.test.ts`: skor, alasan, bobot, normalisasi data kosong, tren, ekstraksi sinyal.
- `app/test/utils/csvImport.test.ts`: parser (kutip, CRLF, BOM, `;`), sanitasi injeksi, validasi per baris, duplikat, mata kuliah tujuan, laporan error.
- `app/test/utils/exportFiles.test.ts`: tabel nilai/presensi/roster, CSV ber-BOM, XLSX (tipe sel, tanpa formula), PDF (`%PDF-`).
- `app/test/stores/atRisk.test.ts`: store demo (urutan risiko, pengingat sampai ke notifikasi mahasiswa, tindak lanjut, bobot) dan impor demo (enroll + duplikat).

### Batasan / belum diverifikasi

- **Belum pernah dijalankan terhadap Supabase sungguhan:** migrasi W4, RPC `send_risk_reminder`, endpoint `POST /api/import/students`, dan cron `/api/cron/at-risk`. Semuanya hanya ditinjau secara kode, tidak diuji dengan database.
- **Pemeriksaan role server bisa dilewati.** Endpoint impor memeriksa role dari cookie sesi, yang punya kelemahan yang sama seperti di Prioritas 2: cookie bisa diterbitkan untuk role apa pun. RLS dan RPC tetap bergantung pada Supabase Auth.
- **Enrolment tidak seragam.** Dashboard memakai level + sesi, sedangkan cron memakai `enrollments`. Bila keduanya tidak sinkron di database, hasilnya bisa berbeda.
- **Bobot dan ambang belum dikalibrasi.** Bobot risiko adalah tebakan awal, dan ambang (75% kehadiran, 60 lulus, 14 hari) belum dikalibrasi dengan data nyata. Skor ini sinyal untuk ditinjau dosen, bukan keputusan akademik.
- **Riwayat demo tidak bertahan reload.** Intervensi dan riwayat impor demo disimpan di memori modul, jadi hilang saat halaman dimuat ulang.

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

## W3 — Rubrik penilaian + Peer review anonim

Dua fitur di halaman tugas yang sudah ada (tidak ada menu baru): rubrik penilaian per tugas (juga dipakai oleh draf nilai AI) dan peer review anonim antar mahasiswa. Keduanya berjalan penuh dalam mode demo (in-memory) dan dalam mode Supabase.

### Setup produksi

1. Jalankan `supabase/migration-prioritas-3-w3.sql` setelah `migration-prioritas-1.sql` (memakai `current_profile_id()`, `is_course_member()`, `is_course_staff()` dan tabel `notifications`). Skrip ini idempoten dan membuat:
   - tabel `rubrics` (satu per tugas, sekaligus pengaturan peer review: `peer_enabled`, `peer_reviewers` 1–5, `peer_deadline`, `peer_weight` 0–30, `peer_assigned_at`), `rubric_criteria` (nama, bobot %), `rubric_levels` (label, deskriptor, poin), `rubric_scores` (level pilihan dosen per submission × kriteria), dan `peer_reviews`;
   - RLS: rubrik, kriteria, dan level dibaca anggota mata kuliah dan dikelola staf. `rubric_scores` dibaca pemilik jawaban dan dikelola staf. `peer_reviews` dikelola staf; reviewer hanya membaca dan mengisi barisnya sendiri. Pemilik jawaban **tidak** punya SELECT langsung ke `peer_reviews`;
   - trigger `peer_reviews_guard`: menolak review atas jawaban sendiri atau submission dari tugas lain; untuk non-staf, mengunci kolom override/exclude/identitas dan menolak perubahan setelah tenggat review;
   - RPC anonim (SECURITY DEFINER): `get_peer_review_tasks()` (jawaban yang harus direview, tanpa `student_id`) dan `get_received_peer_reviews()` (review atas jawaban sendiri, tanpa `reviewer_id`);
   - trigger `trg_notify_peer_review_assigned` (notifikasi `tugas` ke reviewer saat ditugaskan) dan fungsi `notify_peer_review_deadlines(p_hours)` untuk pengingat tenggat.
2. Tidak ada env baru. Cron `/api/cron/deadline-reminders` kini juga memanggil `notify_peer_review_deadlines` (bila fungsinya belum ada, langkah ini dilewati dengan peringatan di log). Respons cron menambah `peer_created`.

### 1. Rubrik penilaian

- **Membuat/mengedit (dosen):** `/instructor/courses/{id}/assignments` → tombol **📐 Rubrik & Peer** pada kartu tugas. Editor berisi kriteria (nama, deskripsi, bobot %), dan untuk tiap kriteria 2–6 level (label, poin, deskriptor). Ada tombol naik/turun, **Ratakan bobot**, dan **Hapus rubrik**. Validasi (`validateRubricCriteria`): 1–10 kriteria, bobot bilangan bulat 1–100 dengan **total 100%**, poin 0–1000, minimal satu level berpoin > 0. Tugas yang punya rubrik diberi badge "📐 Rubrik" di kartu tugas dan di `/instructor/assignments`.
- **Skor:** skor kriteria = bobot × (poin level dipilih ÷ poin tertinggi kriteria). Total 0–100 dibulatkan ke bilangan bulat karena `submissions.nilai` bertipe INTEGER (`computeRubricScore` di `shared/rubric.ts`).
- **Menilai (dosen):** form **Beri Nilai/Edit Nilai** menampilkan pemilih level per kriteria. Begitu semua kriteria terpilih, skor rubrik otomatis mengisi kolom **Nilai** (masih bisa disesuaikan manual). **Simpan Nilai** menyimpan level per kriteria (`rubric_scores`) lalu nilai lewat jalur lama `assignmentsStore.gradeSubmission`, sehingga gradebook, ekspor, dan notifikasi "Nilai keluar" tetap bekerja. Pilihan yang belum lengkap ditolak; **Kosongkan pilihan rubrik** untuk menilai manual tanpa rubrik.
- **Mahasiswa:** `/assignments/{id}` menampilkan kartu **📐 Rubrik Penilaian** (terbuka sebelum mengumpulkan). Setelah dinilai dengan rubrik, bagian nilai menampilkan **Rincian skor per kriteria** (level terpilih dan kontribusinya).
- **Demo:** tugas `a1` (Hello World, MK101) sudah punya rubrik 3 kriteria (50/30/20).

### 2. Draf nilai AI berbasis rubrik

- Bila tugas punya rubrik, panel **Saran AI** mengirim `rubric_criteria` (bukan rubrik teks bebas; kolom rubrik teks disembunyikan). Tanpa rubrik, perilaku dan kontrak lama tidak berubah.
- **Prompt:** kriteria dan level diberi kode pendek (`K1`, `K1-L2`) dan seluruh rubrik serta jawaban dibungkus `wrapUntrusted`. Model wajib membalas `{"kriteria":[{"kode","level","alasan"}], "feedback", "kekuatan", "perbaikan", "catatan", "injeksi_terdeteksi"}`.
- **Validasi ketat** (`validateRubricModelDraft`): setiap kriteria tepat satu kali, kode level harus milik kriteria itu, alasan wajib (maks. 400 karakter). Output tidak valid → cadangan demo dengan flag `ai_unavailable_fallback`. **Skor dihitung server dari level terpilih**; angka nilai dari model diabaikan.
- **Cadangan deterministik** (`fallbackRubricDraft`): per kriteria, rasio = 0,5 × skor permukaan jawaban (heuristik lama) + 0,5 × cakupan istilah kriteria (nama, deskripsi, deskriptor level), lalu dipilih level dengan poin/maks terdekat. Alasan menyebut angka-angkanya dan diberi label "Heuristik demo".
- **Human-in-the-loop:** **Gunakan saran** hanya mengisi pilihan level, Nilai, dan Feedback di form (BELUM disimpan). Deteksi prompt injection server tetap berjalan.
- **Kontrak:** `POST /api/ai/grade-draft` menerima tambahan `rubric_criteria?: { id, nama, deskripsi?, bobot, levels: { id, label, deskripsi?, poin }[] }[]` dan, bila dikirim, mengembalikan tambahan `rubrik: { kriteria: { criterion_id, level_id, alasan }[], skor }` dengan `nilai_saran = skor`.

### 3. Peer review anonim

- **Pengaturan (dosen):** di panel **📐 Rubrik & Peer**, bagian **👥 Peer Review Anonim**: aktifkan, jumlah reviewer per jawaban (1–5), tenggat review, dan bobot ke nilai akhir (0–30%). Peer review **membutuhkan rubrik**.
- **Penugasan:** **🎲 Tugaskan Reviewer Acak** memakai `assignReviewers` (`shared/peerReview.ts`): penulis yang sudah mengumpulkan (jawaban teks atau file) diurutkan, diacak dengan PRNG ber-seed (mulberry32), lalu disusun melingkar; penulis ke-i mereview jawaban i+1 … i+k. Hasilnya: tidak ada yang menilai diri sendiri, setiap jawaban mendapat tepat k reviewer berbeda, dan setiap reviewer mendapat tepat k tugas. k dibatasi n − 1 (UI memberi tahu bila dibatasi). Acak ulang hanya bisa selama belum ada review terkirim.
- **Mahasiswa (reviewer):** kartu **👥 Peer Review** di `/assignments/{id}` (muncul setelah ia mengumpulkan) berisi "Jawaban 1…n" tanpa nama pemilik. Ia memilih level per kriteria dan menulis komentar (min. 10 karakter), lalu **Kirim Review**. Review bisa diubah sampai tenggat. Lampiran file tidak dibagikan, hanya namanya.
- **Mahasiswa (pemilik):** bagian **Review dari teman (anonim)** menampilkan review yang dihitung sebagai "Reviewer 1…n" (urut id review, bukan identitas), rata-rata nilai peer, dan rumus nilai akhir.
- **Dosen:** daftar per jawaban (dengan nama reviewer, status, skor, rincian level, komentar). Dosen bisa **Timpa** skor sebuah review (0–100, kosongkan untuk menghapus) atau **Kecualikan** review dari rata-rata.
- **Agregasi** (`aggregatePeerScores`): rata-rata skor review yang dihitung (skor timpaan menang; review dikecualikan atau belum dikirim tidak dihitung).
- **Nilai akhir** (`combineScores`): `round(nilai_dosen × (100 − w)/100 + rata_peer × w/100)`. Belum ada nilai dosen → tetap belum dinilai. Belum ada review yang dihitung atau w = 0 → nilai dosen apa adanya. `submissions.nilai` tetap menyimpan nilai dosen; nilai gabungan dihitung saat dibaca (`rubricsStore.finalScoreFor`) dan dipakai di komponen Tugas pada gradebook (`buildGradebook` menerima `rubrics.withFinalScores`), di halaman tugas mahasiswa, dan sebagai badge "Akhir" di daftar pengumpulan dosen.
- **Notifikasi:** penugasan → notifikasi `tugas` "Peer review: {judul}" ke setiap reviewer. Pengingat → notifikasi `deadline` "Tenggat peer review: {judul}" bila masih ada review tertunda dan tenggat ≤ 24 jam. Demo: lewat `notificationsStore.notifyUsers` (dengan opsi baru `includeSelf` untuk pengingat ke user yang sedang login), dijalankan saat halaman tugas dibuka. Supabase: trigger + cron.

### Kode

- Logika murni: `shared/rubric.ts`, `shared/peerReview.ts` (diimpor sebagai `#shared/...` di app; alias `#shared` juga ditambahkan ke `vitest.config.ts`).
- Store: `app/stores/rubrics.ts` (demo + Supabase). Perubahan kecil: `app/stores/gradebook.ts` (nilai peer), `app/stores/notifications.ts` (`includeSelf`).
- Komponen: `RubricEditor.vue`, `RubricGrader.vue` (pilih level / tampilan baca-saja), `PeerReviewManager.vue`, `PeerReviewTasks.vue`, `PeerFeedback.vue`, dan `AiGradeDraft.vue` (mode rubrik) di `app/components/assignments/`.
- Halaman: `app/pages/instructor/courses/[id]/assignments/index.vue`, `app/pages/assignments/[id].vue`, `app/pages/instructor/assignments/index.vue`.
- Server: `server/utils/gradeDraft.ts`, `server/api/ai/grade-draft.post.ts`, `server/api/cron/deadline-reminders.get.ts`.

### Tes

`app/test/shared/rubric.test.ts` (hitung skor, validasi, pemilihan level), `app/test/shared/peerReview.test.ts` (penugasan: tanpa menilai diri sendiri, seimbang, deterministik, batas k; agregasi dengan timpaan/pengecualian; nilai gabungan), `app/test/server/gradeDraftRubric.test.ts` (validasi request, prompt berkode, validasi JSON model, cadangan deterministik, jalur AI dengan fetch mock, perilaku lama tanpa rubrik), `app/test/stores/rubrics.test.ts` (alur demo end-to-end termasuk gradebook dan notifikasi), `app/test/components/AiGradeDraftRubric.test.ts`.

### Batasan

- **Anonimitas di mode demo hanya di tingkat UI:** semua data ada di memori browser. Di mode Supabase identitas disaring oleh RLS + RPC, tetapi peninjauan keamanan menyeluruh belum dilakukan (sistem demo).
- **Skor review dihitung di klien:** reviewer yang memanggil API langsung bisa menulis `skor` yang tidak cocok dengan `selections`. Dosen bisa menimpa/mengecualikan; untuk produksi sungguhan skor sebaiknya dihitung ulang di DB/server.
- **Total bobot 100%** hanya divalidasi di aplikasi (kriteria disimpan per baris).
- **Mengedit rubrik** setelah dipakai menilai: level/kriteria yang dihapus ikut menghapus rincian skornya; `nilai` yang sudah tersimpan tidak dihitung ulang. Review peer lama tetap memakai `selections` lama.
- **Ekspor Excel nilai tugas** masih memakai nilai dosen (`submissions.nilai`), belum nilai gabungan peer; gradebook sudah memakai nilai gabungan.
- **Data demo tidak persisten:** rubrik, skor rubrik, dan review hilang saat halaman dimuat ulang.
- **Belum diuji terhadap backend nyata:** migrasi SQL, RLS, RPC, trigger notifikasi, dan jalur Supabase store belum dijalankan terhadap database sungguhan. Jalur AI hanya diuji dengan fetch mock.

---

## 3b-A — Jawaban per soal di store kuis + jalur belajar adaptif

Sebelumnya `quizStore.submitQuiz` hanya menyimpan skor total, sehingga skor topik di `/student/learning-path` untuk kuis yang baru dikerjakan selalu **estimasi** dari persentase. Sekarang jawaban per soal ikut disimpan dan dipakai sebagai data asli.

### Setup produksi

Jalankan `supabase/migration-prioritas-3b-a.sql` (idempoten, setelah `schema.sql`): kolom `quiz_attempts.answers` (jsonb, array), `quiz_answers.attempt_id` (FK ke `quiz_attempts`, cascade) dan `quiz_answers.points`, plus indeks. RLS tidak diubah. Bila migrasi belum dijalankan, store otomatis mencoba ulang insert tanpa kolom baru (jalur belajar tetap bekerja lewat `quiz_answers`).

### Perilaku

- **Tipe:** `QuizAttempt.answers?: QuizAttemptAnswer[] | null` dengan `{ question_id, jawaban (a–d | null), is_correct, points }` (`app/types/database.ts`). Soal yang tidak dijawab dicatat dengan `jawaban: null`, salah, 0 poin.
- **Submit** (`app/stores/quiz.ts`): `gradeAnswers()` menilai per soal; skor = jumlah poin. Demo: tersimpan di attempt di memori. Supabase: `persistAttempt()` (dipanggil di latar belakang; promise via `waitForPersist()`) menyisipkan `quiz_attempts` beserta `answers`, lalu satu baris `quiz_answers` per soal yang dijawab (`attempt_id`, `points`), dan menyelaraskan id lokal dengan UUID dari DB.
- **Jalur belajar** (`app/utils/learningPath.ts`): urutan sumber per soal — `attempt.answers` (selalu milik percobaan itu) → `quiz_answers`/data demo (dengan cek waktu lama) → estimasi dari persentase. `TopicStat.estimated_count` dan `CourseLearningPath.exactResults/estimatedResults` baru; `estimated` tetap ada (kompatibel).
- **UI** (`/student/learning-path`): badge "estimasi" hanya bila semua hasil topik estimasi, "sebagian estimasi (x/n)" bila campuran, tanpa badge bila data asli. Catatan atas: info estimasi (penuh/sebagian) atau ✅ "Semua skor topik dihitung dari jawaban per soal yang tersimpan."
- **Kompatibel mundur:** percobaan demo lama (`qa1`–`qa4`) tidak diberi `answers`; hasilnya tetap dari `DEMO_QUIZ_ANSWERS` sehingga sama persis seperti sebelumnya.

### Tes

`app/test/stores/quiz-answers.test.ts` (penilaian per soal, submit demo menyimpan jawaban, jalur belajar memakai data asli setelah mengerjakan kuis, jalur Supabase dengan klien palsu termasuk retry tanpa kolom baru) dan tambahan di `app/test/utils/learningPath.test.ts` (jawaban di attempt vs fallback, prioritas atas `quiz_answers`, penanda sebagian estimasi).

### Batasan

- Jalur Supabase (insert + migrasi) hanya diuji dengan klien palsu, belum terhadap database sungguhan.
- Penyimpanan Supabase berjalan di latar belakang; bila gagal hanya dicatat di console (UI tetap menampilkan hasil).
- Data demo tidak persisten: jawaban kuis yang baru dikerjakan hilang saat halaman dimuat ulang.

## 3b-B — Ekspor nilai memakai nilai gabungan peer review

- **Masalah:** batasan W3 di atas ("ekspor nilai tugas masih memakai nilai dosen") untuk ekspor buku nilai di `/instructor/import-export` dan `/admin/import-export`.
- **Perilaku:** ekspor Excel/PDF/CSV buku nilai memakai baris yang sama dengan gradebook di layar (`gradebook.courseGradebook`; komponen Tugas sudah memakai nilai gabungan via `rubrics.withFinalScores`). Untuk setiap tugas yang peer review-nya aktif dengan bobot > 0 ditambahkan 5 kolom setelah UAS: `{judul} - Nilai Dosen`, `- Nilai Peer (rata-rata)`, `- Review Dihitung` ("x dari n"), `- Bobot Peer (%)`, `- Nilai Akhir Tugas`. Nilai Akhir, Huruf, dan Status tidak berubah dan sama dengan gradebook. Tanpa peer review, tata letak kolom sama persis seperti sebelumnya. PDF menambahkan rumus peer di catatan kaki.
- **Peer review belum lengkap:** rata-rata peer hanya dari review yang dihitung (`aggregatePeerScores`); belum ada review yang dihitung → kolom peer "-" dan Nilai Akhir Tugas = nilai dosen. Tidak mengumpulkan dan lewat tenggat → Nilai Dosen "-", Nilai Akhir Tugas 0 (sama seperti komponen Tugas).
- **Tanpa duplikasi rumus:** `buildPeerBreakdown` / getter `gradebook.coursePeerBreakdown` (`app/stores/gradebook.ts`) memakai `rubrics.withFinalScores`, `rubrics.peerSummaryFor`, `rubrics.rubricFor`, dan helper baru `assignmentScore` yang kini juga dipakai `assignmentComponent`. `gradebookTable` (`app/utils/exportFiles.ts`) menerima parameter opsional `peer`. Sanitasi CSV injection (termasuk judul tugas di header) dan BOM UTF-8 tetap.
- **Tes:** `app/test/utils/exportPeerGrades.test.ts` — alur demo: tanpa peer review, peer review belum lengkap, peer review lengkap + timpaan dosen; tiap kasus membuktikan angka ekspor == gradebook (Tugas, Nilai Akhir, Huruf, nilai akhir per tugas == `rubrics.finalScoreFor`, Tugas dihitung ulang dari kolom ekspor) dan isi CSV/XLSX hasil parse == tabel; plus guard injection pada judul tugas.
- **Batasan:** ekspor per tugas di halaman daftar tugas dosen (`useExportGrades.exportCourseGrades`, tombol "Export Nilai ke Excel") belum diubah dan masih memakai nilai dosen. Mode dev Vite: impor jsPDF pertama kali bisa memicu reload halaman sehingga data demo di memori hilang (tidak terjadi di build produksi).

> **Tindak lanjut 3b-B:** tombol "Export Nilai ke Excel" di halaman tugas dosen (`useExportGrades.exportCourseGrades`) sekarang juga memakai nilai akhir gabungan (dosen + peer). Untuk tugas dengan peer review ada kolom tambahan "Nilai Dosen"; tugas tanpa peer review tidak berubah.

## 3b-C — Rapikan tampilan mobile (overflow horizontal)

**Masalah:** di layar 360–414px beberapa halaman (gradebook, analitik, kalender, presensi mahasiswa, nilai, kampus/kuis admin) melebar horizontal sehingga seluruh halaman bisa digeser ke samping. Akar masalahnya: `.main-area` di layout adalah flex item dengan `min-width: auto` bawaan, sehingga konten terlebar (tabel/grid) memaksa area utama (dan topbar) ikut melebar melebihi viewport.

**Perbaikan di akar:**
- `app/layouts/{dashboard,instructor,admin}.vue`: `min-width: 0` pada `.main-area` dan `.content`; `default.vue`: pada `.layout-main`. Hanya CSS, isi navigasi tidak diubah. Admin: `.topbar-right` diberi `min-width: 0` dan di ≤400px nama user di topbar disembunyikan (nama tetap ada di sidebar).
- `app/assets/css/main.css`: utilitas global **`.table-scroll`** (`max-width: 100%`, `min-width: 0`, `overflow-x: auto`, `overscroll-behavior-x: contain`) untuk membungkus tabel/grid lebar agar menggulir di dalam kotaknya sendiri, plus `max-width: 100%` untuk media di `main.content`. Tanpa warna hardcode, aman untuk tema gelap.
- Tabel memakai `.table-scroll`: gradebook, analitik, `AtRiskDashboard`, `ImportExportPanel` (tambalan `contain: inline-size` sebelumnya dihapus karena akar sudah diperbaiki). Presensi mahasiswa: grid riwayat dibungkus `.table-scroll` dengan baris `min-width: 26rem`.
- Penyesuaian kecil per halaman: kartu statistik nilai mahasiswa jadi 2 kolom di ≤480px; kartu kampus admin (`minmax(min(340px, 100%), 1fr)`, tombol aksi pindah ke baris sendiri di ≤768px); header kartu kuis admin `flex-wrap`.

**Audit:** `node scripts/audit-mobile-overflow.mjs [--width=360 --width=390 ...] [--dark] [--strict] [--json=out.json]` (butuh app berjalan, `BASE_URL` default `http://localhost:3000`). Skrip login sebagai mahasiswa/dosen/admin demo, membuka 29 halaman, mengukur `scrollWidth > clientWidth` dan elemen yang melewati viewport tanpa dipotong ancestor yang bisa digulir. Hasil (mode dev): sebelum — 8 dari 29 halaman overflow di 390px, 25 di 360px, 7 di 414px (0 di 1280px); sesudah — 0 di 360/390/414/1280px dan 0 di 390px tema gelap.

**Tes:** `app/test/shared/mobileOverflowCss.test.ts` (cek statis: `.table-scroll`, `min-width: 0` di layout, setiap `<table>` dibungkus `.table-scroll`).

**Batasan:** audit hanya pada data demo (tabel dengan data lebih banyak/panjang belum diuji); dialog/modal dan halaman di luar daftar audit (mis. AI chat, playground, detail kuis) belum diaudit; pemeriksaan visual hanya lewat beberapa screenshot headless Chrome, belum di perangkat sungguhan.
