# Bagian 1: Fondasi Produk

## Ringkasan Produk (§1)
LMS Mahasiswa adalah aplikasi Learning Management System sederhana yang membantu mahasiswa mengakses mata kuliah, membaca materi, mengerjakan tugas, memantau progres pembelajaran, dan melihat nilai melalui satu dashboard.

Aplikasi menggunakan Nuxt sebagai framework full-stack frontend, Supabase sebagai penyedia autentikasi dan PostgreSQL, serta Pinia untuk mengelola state aplikasi.

MVP berfokus pada pengalaman mahasiswa. Fitur dosen dan administrator dapat dikembangkan setelah fitur mahasiswa stabil.

---

## Latar Belakang (§2)
Mahasiswa sering menerima materi, tugas, pengumuman, dan informasi perkuliahan melalui beberapa platform yang berbeda. Hal tersebut dapat menyebabkan:
- Materi sulit ditemukan
- Mahasiswa melewatkan deadline tugas
- Progres pembelajaran tidak terdokumentasi
- Informasi mata kuliah tersebar
- Nilai dan status tugas sulit dipantau
- Pengalaman pembelajaran tidak konsisten

LMS Mahasiswa menyediakan satu aplikasi terpusat untuk mengakses seluruh aktivitas akademik tersebut.

---

## Tujuan Produk (§3)
1. Menyediakan dashboard pembelajaran mahasiswa
2. Menampilkan mata kuliah yang sedang diikuti
3. Menampilkan materi berdasarkan mata kuliah
4. Menyimpan progres penyelesaian materi
5. Menampilkan tugas dan deadline
6. Memungkinkan mahasiswa mengumpulkan tugas
7. Menampilkan status dan nilai tugas
8. Menyediakan autentikasi yang aman
9. Menyediakan aplikasi responsif untuk desktop dan mobile
10. Menyediakan fondasi yang mudah dikembangkan menjadi LMS lengkap

---

## Target Pengguna (§4)

### Mahasiswa
- Login ke aplikasi
- Melihat ringkasan aktivitas belajar
- Melihat mata kuliah yang sedang diambil
- Membuka materi perkuliahan
- Menandai materi sebagai selesai
- Melihat tugas dan deadline
- Mengirim jawaban tugas
- Melihat status pengumpulan
- Melihat nilai dan feedback
- Mengelola profil pribadi

### Instruktur (dalam MVP)
Ada 3 instruktur yang mengelola mata kuliah. Setiap instruktur memiliki:
- Login ke aplikasi
- Dashboard instruktur
- Melihat mata kuliah yang diampu
- Membuat dan mengelola materi perkuliahan
- Membuat dan mengelola tugas
- Melihat submission mahasiswa
- Memberikan nilai dan feedback
- Membuat pengumuman
- Mengelola profil pribadi

### Dosen (versi berikutnya)
- Membuat mata kuliah, materi, tugas
- Melihat submission mahasiswa
- Memberikan nilai dan feedback
- Membuat pengumuman

### Administrator (versi berikutnya)
- Mengelola akun mahasiswa dan dosen
- Mengelola semester dan program studi
- Mengelola enrollment
- Melihat statistik penggunaan LMS

---

## Ruang Lingkup MVP (§5)

### Fitur dalam MVP
- Landing page, login/logout, protected dashboard
- Dashboard overview, daftar & detail mata kuliah
- Level kelas (1–4) dan waktu pelaksanaan (pagi/malam) per mata kuliah
- Daftar & detail materi, progress materi
- Daftar & detail tugas, pengumpulan tugas (teks/URL)
- Status submission, nilai dan feedback
- Pengumuman, profil mahasiswa
- Dashboard instruktur (3 instruktur)
- Responsive design, loading/empty/error state
- Demo mode tanpa Supabase
- Deployment ke Vercel

### Fitur di luar MVP
Video conference, live chat, forum diskusi, quiz interaktif, ujian dengan timer, plagiarism checker, integrasi pembayaran, integrasi sistem akademik, push/email notification, mobile app native, dashboard dosen/administrator lengkap, multi-campus, AI tutor, sertifikat otomatis.

---

## Roadmap Setelah MVP (§33)
- **v1.1:** Dashboard dosen, CRUD mata kuliah/materi/tugas, penilaian submission, upload file
- **v1.2:** Quiz, forum diskusi, notifikasi email, kalender akademik, export nilai
- **v2.0:** Multi-role administrator, program studi, semester akademik, integrasi sistem akademik, PWA, push notification, AI learning assistant, analitik pembelajaran

---

## Success Metrics (§32)
MVP berhasil jika:
- Pengguna dapat login
- Dashboard hanya dapat diakses setelah login
- Mahasiswa dapat melihat mata kuliah & membaca materi
- Progress materi tersimpan
- Mahasiswa dapat melihat & mengirim tugas
- Mahasiswa hanya dapat melihat data sendiri
- Aplikasi responsif, production build & deployment berhasil
- Tidak ada secret key pada frontend
- Seluruh tabel utama memiliki RLS
- Core E2E flow berhasil
