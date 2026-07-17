# Bagian 2: Kebutuhan Fungsional

## User Stories

### Authentication (§6.1)
- Sebagai mahasiswa, saya ingin login dengan Nama + NPM agar dapat mengakses data pembelajaran saya
- Sebagai mahasiswa, saya ingin memilih kelas (level + waktu) lalu memilih nama saya dari daftar
- Sebagai mahasiswa, saya ingin logout agar akun saya tetap aman
- Sebagai instruktur, saya ingin login dengan memilih nama saya dari daftar instruktur
- Sebagai pengguna yang belum login, saya tidak boleh membuka dashboard
- Sebagai pengguna yang sudah login, saya tidak perlu kembali ke halaman login

### Dashboard (§6.2)
- Sebagai mahasiswa, saya ingin melihat jumlah mata kuliah aktif
- Sebagai mahasiswa, saya ingin melihat tugas yang belum selesai
- Sebagai mahasiswa, saya ingin melihat deadline terdekat
- Sebagai mahasiswa, saya ingin melihat progres pembelajaran
- Sebagai mahasiswa, saya ingin melihat pengumuman terbaru
- Sebagai mahasiswa, saya ingin melihat tugas mendatang di dashboard
- Sebagai instruktur, saya ingin melihat ringkasan mata kuliah yang saya ampu
- Sebagai admin, saya ingin melihat ringkasan seluruh mahasiswa, instruktur, dan mata kuliah

### Mata Kuliah (§6.3)
- Sebagai mahasiswa, saya ingin melihat mata kuliah yang saya ikuti
- Sebagai mahasiswa, saya ingin mencari mata kuliah
- Sebagai mahasiswa, saya ingin membuka detail mata kuliah
- Sebagai mahasiswa, saya ingin melihat dosen/instruktur dan deskripsi mata kuliah
- Sebagai mahasiswa, saya ingin melihat level kelas (1–4) dan waktu pelaksanaan (pagi/malam)
- Sebagai mahasiswa, saya ingin melihat daftar materi berdasarkan urutan
- Sebagai instruktur, saya ingin melihat mata kuliah yang saya ampu
- Sebagai instruktur, saya ingin melihat daftar mahasiswa di mata kuliah saya

### Materi (§6.4)
- Sebagai mahasiswa, saya ingin membaca materi
- Sebagai mahasiswa, saya ingin membuka link atau file materi
- Sebagai mahasiswa, saya ingin menandai materi sebagai selesai/batal selesai (toggle)
- Sebagai mahasiswa, saya ingin melihat persentase progress mata kuliah
- Sebagai mahasiswa, saya ingin navigasi prev/next antar materi
- Sebagai mahasiswa, saya ingin melihat daftar seluruh materi di sidebar
- Sebagai mahasiswa, saya ingin menggunakan shortcut keyboard (←/→) untuk navigasi

### Tugas (§6.5)
- Sebagai mahasiswa, saya ingin melihat seluruh tugas
- Sebagai mahasiswa, saya ingin memfilter tugas berdasarkan status
- Sebagai mahasiswa, saya ingin mengetahui deadline tugas
- Sebagai mahasiswa, saya ingin melihat countdown waktu tersisa
- Sebagai mahasiswa, saya ingin mengirim jawaban tugas
- Sebagai mahasiswa, saya ingin memperbarui submission sebelum deadline
- Sebagai mahasiswa, saya ingin melihat nilai dan feedback

### Kalender Akademik
- Sebagai mahasiswa, saya ingin melihat jadwal UTS, UAS, dan libur dalam tampilan kalender
- Sebagai mahasiswa, saya ingin melihat event dalam tampilan daftar, bulan, dan timeline horizontal
- Sebagai mahasiswa, saya ingin memfilter event berdasarkan rentang tanggal pada timeline
- Sebagai instruktur, saya ingin melihat kalender akademik yang sama

### Presensi / Kehadiran
- Sebagai instruktur, saya ingin mencatat kehadiran mahasiswa per pertemuan (hadir/izin/sakit/alpha)
- Sebagai instruktur, saya ingin melihat rekap kehadiran di semua mata kuliah yang saya ampu
- Sebagai instruktur, saya ingin mengatur jumlah pertemuan dan tanggal presensi
- Sebagai mahasiswa, saya ingin melihat rekap kehadiran saya di setiap mata kuliah
- Sebagai mahasiswa, saya ingin melihat persentase kehadiran saya

### Penilaian Langsung
- Sebagai instruktur, saya ingin memberi nilai ke semua mahasiswa sekaligus tanpa perlu menunggu pengumpulan tugas
- Sebagai instruktur, saya ingin melihat daftar semua mahasiswa terdaftar saat memberi nilai

### Hasil Penilaian
- Sebagai mahasiswa, saya ingin melihat semua nilai tugas yang sudah dinilai instruktur dalam satu halaman
- Sebagai mahasiswa, saya ingin melihat rata-rata, tertinggi, dan terendah nilai tugas saya
- Sebagai mahasiswa, saya ingin melihat feedback yang diberikan instruktur untuk setiap tugas

### AI Chat (§6.7)
- Sebagai mahasiswa, saya ingin bertanya tentang materi perkuliahan
- Sebagai mahasiswa, saya ingin mendapatkan bantuan mengerjakan tugas
- Sebagai mahasiswa, saya ingin chat dengan AI assistant

### Profil (§6.6)
- Sebagai mahasiswa, saya ingin melihat profil saya
- Sebagai mahasiswa, saya ingin memperbarui nama dan data profil
- Sebagai mahasiswa, saya ingin melihat NIM dan program studi

---

## Alur Pengguna (§7)

### Alur Login Mahasiswa
```
Landing Page → /login → Pilih "Mahasiswa" → Pilih Level Kelas (1–4) → Pilih Waktu (Pagi/Malam) → Pilih Nama + NPM dari daftar → Redirect ke /dashboard
```

### Alur Login Instruktur
```
Landing Page → /login → Pilih "Instruktur" → Pilih Nama dari daftar instruktur → Redirect ke /instructor/dashboard
```

Gagal: Tampilkan pesan error → pengguna dapat mencoba kembali

### Alur Mempelajari Materi
```
Dashboard → Mata Kuliah → Pilih MK → Pilih Materi → Baca Materi → Tandai Selesai → Progress Diperbarui
```

### Alur Mengumpulkan Tugas
```
Dashboard → Tugas → Pilih Tugas → Baca Instruksi → Isi Jawaban/URL → Submit → Status: Submitted
```

### Alur Melihat Nilai
```
Tugas → Filter Graded → Pilih Tugas → Lihat Nilai → Lihat Feedback Dosen
```

### Alur Presensi (Instruktur)
```
Dashboard Instruktur → Mata Kuliah → Pilih MK → Presensi → Pilih Pertemuan → Atur Tanggal → Pilih Status per Mahasiswa → Simpan Semua
```

### Alur Melihat Presensi (Mahasiswa)
```
Dashboard → Presensi → Lihat Rekap per MK → Lihat Persentase Kehadiran
```

### Alur Nilai Langsung (Instruktur)
```
Dashboard Instruktur → Mata Kuliah → Pilih MK → Tugas → Pilih Tugas → Klik "Nilai Semua" → Isi Nilai per Mahasiswa → Simpan Semua
```

---

## Halaman Aplikasi (§8)

### Mahasiswa Routes
| Route | Halaman | Akses |
|-------|---------|-------|
| `/` | Landing Page | Publik |
| `/login` | Login (pilih role & identitas) | Guest |
| `/dashboard` | Dashboard mahasiswa | Auth |
| `/courses` | Daftar Mata Kuliah | Auth |
| `/courses/[id]` | Detail Mata Kuliah | Auth |
| `/courses/[courseId]/lessons/[lessonId]` | Detail Materi | Auth |
| `/assignments` | Daftar Tugas | Auth |
| `/assignments/[id]` | Detail Tugas | Auth |
| `/profile` | Profil mahasiswa | Auth |
| `/ai/chat` | AI Chat assistant | Auth |
| `/playground` | Code playground (Pyodide) | Auth |
| `/calendar` | Kalender akademik | Auth |
| `/student/attendance` | Presensi saya | Auth |

### Instruktur Routes
| Route | Halaman | Akses |
|-------|---------|-------|
| `/instructor/dashboard` | Dashboard instruktur | Auth |
| `/instructor/courses` | Daftar MK yang diampu | Auth |
| `/instructor/courses/[id]` | Detail MK + manage | Auth |
| `/instructor/courses/[id]/lessons` | Kelola materi | Auth |
| `/instructor/courses/[id]/lessons/create` | Buat materi | Auth |
| `/instructor/courses/[id]/lessons/[lessonId]` | Lihat materi | Auth |
| `/instructor/courses/[id]/lessons/[lessonId]/edit` | Edit materi | Auth |
| `/instructor/courses/[id]/assignments` | Kelola tugas | Auth |
| `/instructor/courses/[id]/assignments/create` | Buat tugas | Auth |
| `/instructor/courses/[id]/assignments/[assignmentId]` | Lihat submission | Auth |
| `/instructor/courses/[id]/students` | Daftar mahasiswa | Auth |
| `/instructor/courses/[id]/attendance` | Presensi per pertemuan | Auth |
| `/instructor/attendance` | Rekap presensi semua MK | Auth |
| `/instructor/profile` | Profil instruktur | Auth |

### Admin Routes
| Route | Halaman | Akses |
|-------|---------|-------|
| `/admin/dashboard` | Dashboard admin | Admin |
| `/admin/students` | CRUD Mahasiswa | Admin |
| `/admin/instructors` | CRUD Instruktur | Admin |
| `/admin/courses` | CRUD Mata Kuliah | Admin |
| `/admin/assignments` | Semua tugas | Admin |
| `/admin/profile` | Profil admin | Admin |

### Shared Routes
| Route | Halaman | Akses |
|-------|---------|-------|
| `/calendar` | Kalender akademik (list, bulan, timeline) | Auth |
| `/student/attendance` | Presensi mahasiswa (lihat rekap) | Auth |

### Landing Page
- Nama aplikasi, deskripsi, keunggulan, tombol login, preview, footer
- Responsif, tanpa horizontal scrolling

### Login
- Pilih role: Mahasiswa atau Instruktur
- Mahasiswa: pilih level kelas (1–4) → pilih waktu (pagi/malam) → pilih nama + NPM dari daftar
- Instruktur: pilih nama dari daftar instruktur
- Loading indicator, pesan error, info demo mode
- Daftar identitas bersumber dari data kelas (seed/database)

### Dashboard (Mahasiswa)
- Sapaan, jumlah MK/tugas, progress, deadline terdekat, MK terbaru, pengumuman
- Skeleton loading, empty state, error state

### Dashboard (Instruktur)
- Sapaan, ringkasan MK yang diampu, jumlah mahasiswa, tugas perlu dinilai
- Skeleton loading, empty state, error state

### Daftar Mata Kuliah
- Search (nama/kode), filter status, progress per MK, dosen/instruktur, jumlah materi
- Filter berdasarkan level kelas (1–4) dan waktu pelaksanaan (pagi/malam)

### Detail Mata Kuliah
- Nama, kode, dosen/instruktur, deskripsi, semester, SKS, progress
- Level kelas (1–4) dan waktu pelaksanaan (pagi/malam)
- Daftar materi & tugas

### Detail Materi
- Judul, isi, URL video/file, tombol selesai, navigasi prev/next

### Daftar Tugas
- Search, filter status & MK, urut deadline, label status (Not Submitted/Submitted/Late/Graded)

### Detail Tugas
- Judul, MK, instruksi, deadline, nilai max, jawaban teks/URL, submit, status, nilai, feedback

### Profil (Mahasiswa)
- Nama, email, NIM, program studi, angkatan, avatar, bio
- Edit profil (email tidak bisa diubah)

### Profil (Instruktur)
- Nama, email, avatar, bio
- Edit profil

---

## Definition of Done (§23)
Fitur selesai jika:
- Sesuai user story & acceptance criteria
- Tidak ada error TypeScript/build
- Responsif, memiliki loading/empty/error state
- Tidak membocorkan secret, mematuhi RLS
- Dapat digunakan dengan keyboard
- Lulus test utama, tidak merusak fitur lain
- Dokumentasi diperbarui
