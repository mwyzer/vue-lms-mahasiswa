# Bagian 12: Fitur Prioritas 2 (AI)

Empat fitur AI yang ditambahkan setelah Prioritas 1: AI tutor berbasis materi (RAG), pembuatan soal kuis dari materi, draf nilai + feedback untuk tugas, dan skor kemiripan semantik pada pemeriksaan plagiarisme. Semuanya berjalan **tanpa konfigurasi** dalam mode demo (tanpa kunci API AI) memakai cadangan lokal yang deterministik. Mode demo cukup untuk mencoba alurnya, tetapi kualitasnya jauh di bawah mode dengan kunci API — lihat bagian "Mode demo vs. kunci API".

Prinsip yang sama di keempat fitur: AI hanya **menyarankan**. Tidak ada nilai, soal, atau tuduhan plagiarisme yang tersimpan tanpa tindakan eksplisit instruktur.

## Setup produksi

1. Jalankan `supabase/migration-prioritas-2.sql` di SQL Editor Supabase (setelah `schema.sql` dan `migration-prioritas-1.sql`). Skrip ini mengaktifkan ekstensi `vector`, membuat tabel `lesson_chunks` (embedding `vector(1536)`) dan fungsi `match_lesson_chunks`. Fungsi itu hanya boleh dieksekusi oleh `service_role`.
2. Isi environment variable server (Vercel → Settings → Environment Variables):

   | Variable | Kegunaan | Bawaan |
   |---|---|---|
   | `NUXT_AI_API_KEY` | Kunci API OpenAI (atau API lain yang kompatibel). Kosong = mode demo | kosong |
   | `NUXT_AI_MODEL` | Model chat untuk tutor, soal kuis, dan draf nilai | `gpt-4o-mini` |
   | `NUXT_AI_EMBEDDING_MODEL` | Model embedding untuk tutor dan plagiarisme. Vektor disimpan 1536 dimensi | `text-embedding-3-small` |
   | `NUXT_AI_BASE_URL` | Base URL API yang kompatibel OpenAI (`/chat/completions`, `/embeddings`) | `https://api.openai.com/v1` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Mengaktifkan indeks pgvector (tutor dan endpoint indeks). Juga dipakai cron Prioritas 1 | kosong |

   `SUPABASE_SERVICE_ROLE_KEY` juga bisa diisi lewat `NUXT_SUPABASE_SERVICE_ROLE_KEY` (runtimeConfig `supabaseServiceRoleKey`). Semua variable ini ada di `.env.example`.
3. **Indeks materi.** Instruktur membuka **AI Assistant** (`/ai/chat`) dan menekan **"Indeks materi untuk AI"**. Tombol ini mengirim `POST /api/ai/index-lessons` sekali per mata kuliah yang ia ampu. Lakukan setelah menambah atau mengubah materi. Potongan materi yang tidak berubah (hash dan mode embedding sama) dilewati, dan potongan yang sudah tidak ada dihapus. Tanpa indeks, tutor tetap berfungsi: ia membaca teks materi yang dikirim klien (lihat fitur 1).

## 1. AI tutor berbasis materi (RAG)

- **UI:** halaman `/ai/chat` (semua role yang login). Setiap jawaban yang bersumber dari materi diawali "Berdasarkan materi …" dan diikuti chip **📖 Sumber**. Chip membuka materinya (mahasiswa: `/courses/{id}/lessons/{lesson}`, instruktur: `/instructor/courses/{id}/lessons`), dan cuplikannya bisa dibuka. Pertanyaan di luar materi dijawab tanpa sumber.
- **Retrieval** (`server/utils/rag.ts`):
  - **pgvector**, bila service role key dan URL Supabase tersedia dan mata kuliahnya berupa UUID asli. Server sendiri yang membatasi pencarian ke mata kuliah yang boleh dibaca user. Bila gagal atau tidak menemukan apa pun, jatuh ke cara berikut.
  - **Konteks klien** (bawaan/demo): materi dikirim di `context.lessons`, dipotong, di-embed bersama pertanyaan, lalu diurutkan dengan kosinus. Ambang skor minimum `MIN_SCORE` adalah 0,3 (API) dan 0,2 (lokal). Hasilnya maksimal 5 potongan dan 3 sumber.
- **Jawaban:** dengan kunci API, model menjawab dari potongan materi yang dibungkus sebagai data tak tepercaya. Dalam mode demo atau saat AI gagal, jawabannya adalah **kutipan ekstraktif** dari materi terbaik. Bila tidak ada materi relevan, dipakai basis pengetahuan demo yang tetap.
- **Materi demo:** materi l1–l6 (MK101 Pemrograman Dasar, MK102 Matematika Diskrit) sengaja berisi paragraf sungguhan agar tutor dan generator soal bisa didemokan. Mata kuliah demo lain belum punya materi.
- **Kode:** `server/api/ai/chat.post.ts`, `server/api/ai/index-lessons.post.ts`, `server/utils/rag.ts`, `app/composables/useAiChat.ts`, `app/components/common/AiChat.vue`, `app/pages/ai/chat.vue`.

## 2. Generate soal kuis dari materi

- **UI:** tombol **"✨ Generate dengan AI"** ada di dua tempat:
  - kartu kuis di `/instructor/quiz`;
  - bagian "Daftar Soal" (di samping Import CSV) di `/instructor/courses/{id}/quiz`.
- **Alur:** pilih materi dari mata kuliah kuis → atur jumlah (1–10) dan tingkat kesulitan (mudah/sedang/sulit) → tinjau draf → simpan. Saat meninjau, instruktur bisa mengedit pertanyaan, pilihan, dan kunci jawaban, membatalkan pilihan soal tertentu, atau membuat ulang semua draf. Hanya soal yang dipilih yang disimpan, lewat tombol **"Tambahkan N soal ke kuis"** (jalur simpan yang sama dengan import CSV, `quizStore.addQuestionsBulk`). Daftar soal langsung diperbarui tanpa reload.
- Materi yang isinya kurang dari 120 karakter atau lebih dari 50.000 karakter tetap ditampilkan, tetapi tidak bisa dipilih, disertai alasannya.
- `penjelasan` hanya ditampilkan untuk membantu peninjauan dan tidak disimpan (tabel soal tidak punya kolom penjelasan).
- Soal yang sudah ada di kuis dikirim sebagai `existing` agar tidak diulang.
- **Kode:** `server/api/ai/generate-quiz.post.ts`, `server/utils/quizGen.ts`, `app/components/quiz/AiQuizGenerator.vue`.

## 3. Draf nilai + feedback tugas

- **UI:** `/instructor/courses/{id}/assignments`. Klik **Beri Nilai/Edit Nilai** pada satu pengumpulan, lalu **Saran AI** di dalam form penilaian yang terbuka di bawah pengumpulan itu. Panel menampilkan:
  - saran nilai (0–100);
  - feedback untuk mahasiswa;
  - kekuatan dan saran perbaikan;
  - catatan khusus instruktur.
- **"Gunakan saran"** hanya mengisi kolom form dan menampilkan catatan bahwa nilai **BELUM disimpan**. Bila kolom sudah terisi, instruktur diminta konfirmasi dulu. Nilai baru tersimpan lewat tombol **Simpan Nilai** yang biasa, sehingga nilai yang tersimpan adalah nilai setelah diedit instruktur. Notifikasi "Nilai keluar" (Prioritas 1) juga dikirim lewat jalur itu.
- Pengumpulan yang hanya berupa file tidak bisa dibuatkan draf: tombolnya dinonaktifkan, dan API menjawab 422.
- Nama, NPM, dan ID mahasiswa tidak dikirim ke server maupun ke model.
- **Kode:** `server/api/ai/grade-draft.post.ts`, `server/utils/gradeDraft.ts`, `app/components/assignments/AiGradeDraft.vue`.

## 4. Skor kemiripan semantik (plagiarisme)

- **UI:** tombol **🔍 Cek Kemiripan** pada kartu tugas di `/instructor/courses/{id}/assignments`. Hasilnya berupa daftar pasangan jawaban yang kemiripannya di atas ambang, diurutkan dari skor tertinggi. Setiap pasangan menampilkan:
  - dua skor, **Leksikal** (Jaccard 3-gram kata, menandai salin-tempel) dan **Semantik** (kosinus embedding);
  - label jenis kecocokan;
  - cuplikan kedua jawaban.
- Bahasanya netral ("perlu ditinjau"), sebagai sinyal untuk ditinjau dan bukan bukti plagiarisme.
- Ambang bawaan:
  - leksikal ≥ 75%;
  - semantik ≥ 85% (API) atau ≥ 70% (lokal).
  - Jawaban di bawah 20 kata tidak dinilai semantiknya.
  - Bila tersedia minimal 6 pasangan, ambang semantik efektif = maks(ambang, median skor semua pasangan + 10), dibatasi 99. Tujuannya agar soal yang jawabannya memang seragam tidak membuat seluruh kelas tertandai.
- **Kode:** `server/api/plagiarism/check.post.ts`, `server/utils/plagiarism.ts`, `app/composables/usePlagiarism.ts`, `app/components/assignments/PlagiarismResults.vue`.

## Mode demo vs. kunci API

| Fitur | Tanpa `NUXT_AI_API_KEY` (demo) | Dengan kunci API |
|---|---|---|
| AI tutor | Kutipan ekstraktif dari materi yang paling cocok. Pencocokan memakai embedding lokal (hash kata), jadi praktis **leksikal**: sinonim atau parafrase pertanyaan bisa tidak ketemu | Model menyusun jawaban dari potongan materi hasil embedding API, dengan sitasi sumber |
| Generate soal | Soal **isian rumpang (cloze)** buatan mesin: satu istilah dalam kalimat materi dikosongkan, dan pilihan pengecohnya diambil dari kata lain di materi. Label "contoh (mode demo)". Kualitasnya terbatas dan wajib diperiksa | Soal pilihan ganda dari model (mode JSON) yang divalidasi ketat: 4 pilihan, kunci a–d, batas panjang, dan tanpa duplikat |
| Draf nilai | **Heuristik permukaan**, berlabel "Draf DEMO (heuristik kasar, bukan AI)". Rumusnya 40 + 25×cakupan istilah tugas + 20×panjang + 15×struktur. Sistem **tidak memeriksa kebenaran jawaban** | Model menilai berdasarkan tugas dan rubrik (bila ada) lalu mengembalikan nilai, feedback, dan catatan |
| Plagiarisme | Skor "semantik" berjalan dalam **mode aproksimasi offline**: embedding lokal yang pada dasarnya leksikal. Skor ini hanya mengenali teks yang hampir sama dan **tidak dapat mendeteksi parafrase**. UI menampilkan catatan ini | Embedding API dapat menandai parafrase (kata berbeda, isi sama) |

Bila kunci API ada tetapi panggilan AI gagal, setiap fitur jatuh ke cadangan lokal yang sama (draf nilai diberi flag `ai_unavailable_fallback`). Bila batas token harian habis, plagiarisme tetap mengembalikan hasil leksikal dengan `semantic.mode = 'unavailable'`.

## Kontrak endpoint

| Endpoint | Role | Request | Response |
|---|---|---|---|
| `POST /api/ai/chat` | semua user login | `{ message, context?: { courses?, lessons?: { id, course_id, course_kode, course_nama, judul, konten }[] } }`. Pesan maks. 2000 karakter | `{ reply, sources: { lesson_id, course_id, course_kode, judul, excerpt, score }[] }`. Dengan `Accept: text/event-stream`: event `{ word }` lalu satu event `{ sources, done: true }` |
| `POST /api/ai/index-lessons` | instruktur pengampu / admin | `{ course_id, lessons?: { id }[] }` (tanpa `lessons` = semua materi). Teks materi dibaca dari tabel `lessons`, sedangkan `judul`/`konten` dari klien diabaikan | `{ ok, course_id, lessons, chunks, embedded, unchanged, deleted_lessons, mode, rejected[], warning? }`. Mengembalikan **503** bila service role key belum diset |
| `POST /api/ai/generate-quiz` | instruktur / admin | `{ lesson: { judul, konten }, count?: 1–10, difficulty?: 'mudah'\|'sedang'\|'sulit', existing?: string[] }` | `{ questions: { pertanyaan, pilihan_a..d, jawaban_benar, penjelasan }[], source: 'ai'\|'demo', requested, generated }`. Tidak menyimpan apa pun |
| `POST /api/ai/grade-draft` | instruktur / admin | `{ assignment: { judul, deskripsi? }, submission: { text }, rubric?, max_score?: 100 }` | `{ nilai_saran, feedback, kekuatan[], perbaikan[], catatan?, flags[], source }`. Tidak menyimpan apa pun |
| `POST /api/plagiarism/check` | instruktur / admin | `{ submissions: { id, student_id, student_name?, jawaban? }[], thresholds?: { lexical?, semantic? } }`. Maks. 200 jawaban | `{ checked[], flagged[], threshold, total, pairs[], semantic: { mode, threshold, effective_threshold, baseline, min_words, compared, skipped_short, truncated, reason?, note? } }` |

Kode galat yang umum:

- 400: input tidak valid atau terlalu besar;
- 401: belum login;
- 403: role tidak sesuai;
- 413: body terlalu besar;
- 422: soal tidak bisa dibuat dari materi itu, atau jawaban tanpa teks;
- 429: rate limit atau batas harian tercapai.

## Pengaman

- **Role:**
  - Semua `/api/ai/*` melewati `server/middleware/01.ai-safeguard.ts`, yang mewajibkan cookie sesi `lms_session` yang valid.
  - Endpoint soal, draf nilai, dan indeks juga memeriksa role instruktur/admin. Endpoint indeks juga memeriksa bahwa instruktur mengampu `course_id` tersebut.
  - Endpoint plagiarisme memeriksa sesi dan role-nya sendiri.
  - Halaman instruktur juga dilindungi middleware rute `auth` + `instructor`. Halaman kuis per mata kuliah baru mendapatkannya di Prioritas 2.
- **Rate limit** (dalam memori):
  - `/api/ai/*`: 20 permintaan/menit per user dan 100/menit global;
  - `/api/plagiarism/check`: 10/menit per user.
- **Anggaran token harian:** 100.000 token per hari (`server/utils/costTracker.ts`). Anggaran dicek sebelum dan dicatat setelah setiap panggilan chat maupun embedding. Melewatinya menghasilkan 429. Data ini disimpan di memori: reset tengah malam waktu server atau saat restart, dan tidak dibagi antar-instance serverless.
- **Batas ukuran:**
  - Chat: pesan 2000 karakter; konteks maks. 100 materi, 20.000 karakter per materi, total 150.000 karakter.
  - Generate soal: materi 120–50.000 karakter (12.000 karakter pertama masuk prompt); body maks. 256 KB.
  - Draf nilai: jawaban 20.000 karakter (12.000 karakter pertama masuk prompt, flag `submission_truncated` bila terpotong); body maks. 120 KB.
  - Plagiarisme: 50.000 karakter per jawaban.
  - Embedding: maks. 500 teks per panggilan.
- **Prompt injection:**
  - Teks materi dan jawaban mahasiswa dibungkus `wrapUntrusted`, dan prompt memerintahkan model memperlakukannya sebagai data, bukan instruksi.
  - Khusus draf nilai, ada heuristik server (`detectPromptInjection`) yang berjalan **terlepas dari model**, ditambah laporan `injeksi_terdeteksi` dari model. Keduanya memunculkan peringatan "⚠️ Kemungkinan upaya manipulasi penilaian" bagi instruktur.
  - Heuristik ini sengaja konservatif, jadi masih bisa ada injeksi yang lolos.
- **Human-in-the-loop:**
  - Soal AI hanya masuk ke kuis setelah ditinjau dan dipilih.
  - Draf nilai hanya mengisi form, dan penyimpanan tetap lewat tombol biasa.
  - Hasil plagiarisme hanya sinyal untuk ditinjau.

## Memakai provider selain OpenAI (mis. Gemini)

Klien AI memanggil endpoint yang kompatibel dengan OpenAI (`/chat/completions`, `/embeddings`), jadi provider lain cukup diatur lewat env:

```env
NUXT_AI_API_KEY=<gemini-api-key>
NUXT_AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
NUXT_AI_MODEL=gemini-3.6-flash
NUXT_AI_EMBEDDING_MODEL=gemini-embedding-001
```

- Nama model berubah dari waktu ke waktu; cek daftar model aktif di Google AI Studio.
- Kolom `lesson_chunks.embedding` berukuran 1536. Parameter `dimensions: 1536` dikirim untuk model `text-embedding-3-*` dan `gemini-embedding-*`. Model lain yang mengembalikan ukuran berbeda ditolak dan seluruh batch jatuh ke mode lokal; log server menyebut ukuran yang diterima.
- Vektor dari model embedding yang berbeda tidak bisa dibandingkan. Setelah mengganti model embedding, indeks ulang materi (`POST /api/ai/index-lessons`).
- Konfigurasi Gemini belum diuji terhadap API sungguhan; hanya dengan mock.

## Batasan dan yang belum diuji

- **Panggilan OpenAI sungguhan belum pernah dijalankan** dari lingkungan pengembangan ini, karena `api.openai.com` tidak dapat dijangkau. Jalur dengan kunci API hanya diuji terhadap mock dan stub lokal. Uji ulang keempat fitur dengan kunci sungguhan sebelum produksi.
- **Backend pgvector dan endpoint `/api/ai/index-lessons` belum pernah dijalankan terhadap database sungguhan.** Migrasi, `match_lesson_chunks`, dan upsert `lesson_chunks` hanya diuji di tingkat unit. Di demo mode, endpoint indeks selalu menjawab 503.
- **Ambang belum dikalibrasi terhadap model embedding sungguhan:** ambang semantik plagiarisme (85% API / 70% lokal, baseline +10) dan `MIN_SCORE` tutor (0,3 / 0,2). Angka-angka ini adalah tebakan awal, sehingga positif/negatif palsu harus diamati dulu dengan data nyata.
- **Pemeriksaan role di server saat ini bisa dilewati.** Ini kelemahan yang sudah ada sebelum Prioritas 2: `POST /api/auth/session` menerbitkan cookie sesi untuk **role apa pun yang dikirim klien**, tanpa memverifikasi login di server. Karena itu, setiap pemeriksaan role di server, termasuk endpoint AI khusus instruktur (soal, draf nilai, indeks, plagiarisme), bisa dilewati oleh siapa saja yang memanggil endpoint sesi dengan `role: 'instructor'`. Ini baru tertutup setelah login diverifikasi di server, misalnya dari token Supabase Auth. Keputusan ini ada pada pemilik repo.
- Rate limit dan anggaran token disimpan di memori proses, sehingga di Vercel (banyak instance) batas efektifnya lebih longgar dari angka di atas.
- Embedding lokal tidak sebanding dengan embedding API. Indeks yang dibangun dalam mode lokal harus dibangun ulang setelah kunci API dipasang (mode embedding ikut dicatat per potongan).
- Mode demo dari keempat fitur hanya untuk demonstrasi alur: soal cloze, draf nilai heuristik, dan skor "semantik" yang sebenarnya leksikal tidak boleh dipakai untuk keputusan akademik.
