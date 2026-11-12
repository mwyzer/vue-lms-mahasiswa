# Bagian 13: Fitur Prioritas 3

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
