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
