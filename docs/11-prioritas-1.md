# Bagian 11: Fitur Prioritas 1

Empat fitur yang ditambahkan setelah MVP: upload file ke Supabase Storage, notification center, forum diskusi, dan buku nilai berbobot. Semuanya berjalan di **demo mode** tanpa konfigurasi; bagian "Setup produksi" hanya diperlukan saat `NUXT_PUBLIC_DEMO_MODE=false`.

## Setup produksi

1. Jalankan `supabase/migration-prioritas-1.sql` di SQL Editor Supabase (setelah `schema.sql`). Skrip ini idempotent.
2. Isi environment variable server (Vercel → Settings → Environment Variables):

   | Variable | Kegunaan |
   |---|---|
   | `SUPABASE_SERVICE_ROLE_KEY` | Dipakai endpoint cron untuk membuat notifikasi pengingat |
   | `CRON_SECRET` | Secret endpoint cron. Vercel Cron mengirimnya sebagai `Authorization: Bearer …` |

3. Deploy. `vercel.json` menjadwalkan `/api/cron/deadline-reminders` setiap hari pukul 00:00 UTC (07:00 WIB).

Kebijakan RLS di migrasi ini mengenali user lewat `public.current_profile_id()`, yang mencocokkan sesi Supabase Auth ke baris `profiles` melalui `id`, `email`, atau `<npm>@lms.ac.id`. Artinya user **harus login lewat Supabase Auth** (alur login produksi yang sudah ada) agar fitur-fitur ini bisa menulis data.

## 1. Upload file (Supabase Storage)

- Bucket privat `attachments`, batas 20 MB per file (demo mode tetap base64, batas 2 MB).
- Path: `assignments/{course_id}/{user_id}/{timestamp}-{nama}` dan `submissions/{assignment_id}/{user_id}/{timestamp}-{nama}`.
- Kolom `file_url` menyimpan `storage://attachments/<path>`. Saat diunduh, klien membuat signed URL berumur 5 menit.
- Akses: lampiran soal bisa diunduh semua user login; file jawaban hanya oleh pemiliknya, instruktur, dan admin.
- Kode: `app/composables/useFileAttachment.ts` (`uploadAttachment`, `resolveFileUrl`, `downloadFile`).

## 2. Notification center

- Ikon lonceng di topbar ketiga layout (`app/components/common/NotificationBell.vue`), store di `app/stores/notifications.ts`.
- Pemicu notifikasi:

  | Kejadian | Penerima |
  |---|---|
  | Tugas baru dibuat | Mahasiswa terdaftar di mata kuliah |
  | Nilai tugas keluar/berubah | Mahasiswa pemilik submission |
  | Pengumuman baru | Mahasiswa terdaftar di mata kuliah |
  | Balasan forum | Penulis thread |
  | Tenggat ≤ 24 jam dan belum mengumpulkan | Mahasiswa ybs (sekali per tugas) |

- Produksi: baris dibuat oleh trigger Postgres dan fungsi `notify_upcoming_deadlines`, lalu dikirim ke klien lewat Supabase Realtime.
- Demo mode: store lain memanggil `notifyUsers` / `notifyCourseStudents`; pengingat tenggat dihitung di klien.
- Belum termasuk: email dan web push.

## 3. Forum diskusi

- Rute mahasiswa: `/courses/{id}/forum`, instruktur: `/instructor/courses/{id}/forum`.
- Thread per mata kuliah, opsional dikaitkan ke satu materi. Isi ditampilkan sebagai teks biasa (tanpa HTML).
- Instruktur pengampu dan admin bisa menyematkan, mengunci, menghapus, dan menandai balasan sebagai jawaban. Penulis bisa menghapus posting sendiri.
- Kode: `app/stores/forum.ts`, `app/components/forum/`.

## 4. Buku nilai berbobot

- Rute instruktur: `/instructor/courses/{id}/gradebook`. Mahasiswa melihat nilai akhir di `/student/grades`.
- Lima komponen dengan bobot per mata kuliah (total 100%): Tugas, Kuis, Presensi, UTS, UAS. Bawaan: 25 / 15 / 10 / 20 / 30.
- Aturan komponen:
  - **Tugas**: rata-rata nilai tugas. Lewat tenggat tanpa pengumpulan = 0; sudah dikumpulkan tapi belum dinilai = dilewati.
  - **Kuis**: rata-rata skor terbaik tiap kuis yang dikerjakan.
  - **Presensi**: persentase pertemuan berstatus hadir.
  - **UTS/UAS**: diinput manual oleh instruktur di tabel buku nilai.
- Komponen yang belum punya data dilewati dan bobot sisanya dinormalkan ulang; nilai tersebut ditandai **sementara**.
- Huruf mengikuti skala analitik yang sudah ada: A ≥ 85, B ≥ 70, C ≥ 60, D ≥ 50, E < 50.
- Tabel bisa diekspor ke Excel.
- Kode: `app/stores/gradebook.ts` (fungsi hitung murni + store).
