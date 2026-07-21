-- ============================================
-- LMS Mahasiswa — Seed Data for New Tables
-- Run in Supabase SQL Editor after migration-missing-tables.sql
-- ============================================

-- ── 1. SEED QUIZZES ──────────────────────────────────────────
-- Using UUIDs that match demo data references (qz1-qz5)
INSERT INTO quizzes (id, course_id, instructor_id, judul, deskripsi, time_limit_minutes, passing_score, is_active)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'c1', 'i1', 'UTS — Pemrograman Dasar', 'Ujian Tengah Semester mencakup materi pertemuan 1-7.', 90, 60, true),
  ('22222222-2222-4222-8222-222222222222', 'c1', 'i1', 'Kuis 1 — Variabel & Tipe Data', 'Kuis singkat tentang variabel, konstanta, dan tipe data dasar.', 15, 70, true),
  ('33333333-3333-4333-8333-333333333333', 'c5', 'i1', 'UTS — Struktur Data', 'Ujian Tengah Semester Struktur Data.', 90, 60, true),
  ('44444444-4444-4444-8444-444444444444', 'c6', 'i2', 'Kuis 2 — Basis Data SQL', 'Kuis tentang query SELECT, JOIN, dan subquery.', 20, 65, true),
  ('55555555-5555-4555-8555-555555555555', 'c1', 'i1', 'UAS — Pemrograman Dasar', 'Ujian Akhir Semester mencakup seluruh materi.', 120, 60, false)
ON CONFLICT (id) DO NOTHING;

-- ── 2. SEED QUIZ QUESTIONS ───────────────────────────────────
INSERT INTO quiz_questions (id, quiz_id, pertanyaan, pilihan_a, pilihan_b, pilihan_c, pilihan_d, jawaban_benar, urutan)
VALUES
  -- qz1 (UTS Pemrograman Dasar — 5 questions)
  ('a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Apa kepanjangan dari IDE?', 'Integrated Development Environment', 'Internal Development Engine', 'Internet Data Exchange', 'Integrated Design Editor', 'a', 1),
  ('a2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Tipe data manakah yang digunakan untuk menyimpan bilangan desimal di Python?', 'int', 'float', 'string', 'bool', 'b', 2),
  ('a3333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Apa fungsi dari operator "==" dalam pemrograman?', 'Assignment', 'Perbandingan', 'Penugasan', 'Increment', 'b', 3),
  ('a4444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'Struktur perulangan yang pasti menjalankan kode minimal satu kali adalah...', 'for', 'while', 'do-while', 'if', 'c', 4),
  ('a5555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'Array dalam pemrograman digunakan untuk...', 'Menyimpan banyak nilai dalam satu variabel', 'Menyimpan satu nilai saja', 'Menghapus data', 'Mencetak output', 'a', 5),
  -- qz2 (Kuis 1 Variabel — 3 questions)
  ('b1111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Manakah cara yang benar untuk mendeklarasikan variabel di Python?', 'var x = 10', 'x = 10', 'int x = 10', 'declare x = 10', 'b', 1),
  ('b2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'Tipe data apakah yang dihasilkan oleh ekspresi "5 + 3.14"?', 'int', 'float', 'string', 'complex', 'b', 2),
  ('b3333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'String "Hello" + "World" akan menghasilkan...', 'HelloWorld', 'Hello World', 'Hello+World', 'Error', 'a', 3),
  -- qz3 (UTS Struktur Data — 3 questions)
  ('c1111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Struktur data yang menggunakan prinsip LIFO adalah...', 'Queue', 'Stack', 'Tree', 'Graph', 'b', 1),
  ('c2222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', 'Kompleksitas waktu dari Binary Search adalah...', 'O(n)', 'O(n²)', 'O(log n)', 'O(1)', 'c', 2),
  ('c3333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', 'Linked List terdiri dari node-node yang berisi...', 'Data saja', 'Data dan pointer', 'Pointer saja', 'Data dan index', 'b', 3),
  -- qz4 (Basis Data SQL — 3 questions)
  ('d1111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', 'Perintah SQL untuk mengambil data adalah...', 'INSERT', 'UPDATE', 'SELECT', 'DELETE', 'c', 1),
  ('d2222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444', 'JOIN yang mengembalikan semua baris dari kedua tabel adalah...', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN', 'd', 2),
  ('d3333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444', 'Fungsi agregat untuk menghitung jumlah baris adalah...', 'SUM', 'COUNT', 'AVG', 'MAX', 'b', 3)
ON CONFLICT (id) DO NOTHING;

-- ── 3. SEED QUIZ ATTEMPTS ────────────────────────────────────
INSERT INTO quiz_attempts (id, quiz_id, student_id, score, total_questions, percentage, started_at, submitted_at)
VALUES
  ('e1111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 's2', 3, 3, 100, '2025-09-11 08:00:00+00', '2025-09-11 08:12:00+00'),
  ('e2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 's3', 2, 3, 67,  '2025-09-11 09:00:00+00', '2025-09-11 09:10:00+00'),
  ('e3333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 's2', 4, 5, 80,  '2025-10-02 08:00:00+00', '2025-10-02 09:25:00+00'),
  ('e4444444-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444444', 's4', 2, 3, 67,  '2025-09-21 10:00:00+00', '2025-09-21 10:18:00+00')
ON CONFLICT (id) DO NOTHING;

-- ── 4. SEED ACADEMIC EVENTS ──────────────────────────────────
INSERT INTO academic_events (id, course_id, judul, deskripsi, tanggal_mulai, tanggal_selesai, tipe, color)
VALUES
  -- UTS
  ('f1111111-1111-4111-8111-111111111111', 'c1', 'UTS Pemrograman Dasar', 'Ujian Tengah Semester ganjil 2025/2026.', '2025-10-06 08:00:00+00', '2025-10-06 10:00:00+00', 'uts', '#ef4444'),
  ('f2222222-2222-4222-8222-222222222222', 'c5', 'UTS Struktur Data', 'Ujian Tengah Semester.', '2025-10-07 08:00:00+00', '2025-10-07 10:00:00+00', 'uts', '#ef4444'),
  ('f3333333-3333-4333-8333-333333333333', 'c6', 'UTS Basis Data', 'Ujian Tengah Semester.', '2025-10-08 08:00:00+00', '2025-10-08 10:00:00+00', 'uts', '#ef4444'),
  -- UAS
  ('f4444444-4444-4444-8444-444444444444', 'c1', 'UAS Pemrograman Dasar', 'Ujian Akhir Semester ganjil 2025/2026.', '2025-12-15 08:00:00+00', '2025-12-15 10:00:00+00', 'uas', '#f59e0b'),
  ('f5555555-5555-4555-8555-555555555555', 'c5', 'UAS Struktur Data', 'Ujian Akhir Semester.', '2025-12-16 08:00:00+00', '2025-12-16 10:00:00+00', 'uas', '#f59e0b'),
  ('f6666666-6666-4666-8666-666666666666', 'c6', 'UAS Basis Data', 'Ujian Akhir Semester.', '2025-12-17 08:00:00+00', '2025-12-17 10:00:00+00', 'uas', '#f59e0b'),
  -- Tugas
  ('f7777777-7777-4777-8777-777777777777', 'c1', 'Tugas 1 Pemrograman Dasar', 'Buat program kalkulator sederhana.', '2025-09-20 23:59:00+00', '2025-09-20 23:59:00+00', 'tugas', '#3b82f6'),
  ('f8888888-8888-4888-8888-888888888888', 'c1', 'Tugas 2 Pemrograman Dasar', 'Implementasi sorting algorithm.', '2025-10-15 23:59:00+00', '2025-10-15 23:59:00+00', 'tugas', '#3b82f6'),
  ('f9999999-9999-4999-8999-999999999999', 'c5', 'Tugas 1 Struktur Data', 'Buat implementasi linked list.', '2025-09-25 23:59:00+00', '2025-09-25 23:59:00+00', 'tugas', '#3b82f6'),
  ('faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1', 'Kuis 1 Pemrograman Dasar', 'Kuis variabel dan tipe data.', '2025-09-11 08:00:00+00', '2025-09-11 08:15:00+00', 'tugas', '#3b82f6'),
  ('fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'c6', 'Kuis SQL', 'Kuis query SQL dasar.', '2025-09-21 10:00:00+00', '2025-09-21 10:20:00+00', 'tugas', '#3b82f6'),
  -- Libur
  ('fccccccc-cccc-4ccc-8ccc-cccccccccccc', NULL, 'Libur Nasional — Hari Kemerdekaan', 'Hari Kemerdekaan RI.', '2025-08-17 00:00:00+00', '2025-08-17 23:59:00+00', 'libur', '#8b5cf6'),
  ('fddddddd-dddd-4ddd-8ddd-dddddddddddd', NULL, 'Libur Semester Ganjil', 'Libur akhir semester ganjil.', '2025-12-22 00:00:00+00', '2026-01-05 23:59:00+00', 'libur', '#8b5cf6'),
  -- Acara
  ('feeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', NULL, 'Pengumuman Kalender Akademik', 'Kalender akademik tahun ajaran 2025/2026 telah diterbitkan.', '2025-08-01 00:00:00+00', '2025-08-01 23:59:00+00', 'acara', '#06b6d4')
ON CONFLICT (id) DO NOTHING;

-- ── 5. SEED ATTENDANCE ───────────────────────────────────────
INSERT INTO attendance (id, course_id, student_id, instructor_id, tanggal, status, pertemuan, keterangan)
VALUES
  -- c1 (Pemrograman Dasar) — 3 pertemuan, students s2,s3,s4
  ('10111111-1111-4111-8111-111111111111', 'c1', 's2', 'i1', '2025-09-02', 'hadir', 1, NULL),
  ('10222222-2222-4222-8222-222222222222', 'c1', 's3', 'i1', '2025-09-02', 'hadir', 1, NULL),
  ('10333333-3333-4333-8333-333333333333', 'c1', 's4', 'i1', '2025-09-02', 'izin', 1, 'Ada acara keluarga'),
  ('10444444-4444-4444-8444-444444444444', 'c1', 's2', 'i1', '2025-09-09', 'hadir', 2, NULL),
  ('10555555-5555-4555-8555-555555555555', 'c1', 's3', 'i1', '2025-09-09', 'alpha', 2, NULL),
  ('10666666-6666-4666-8666-666666666666', 'c1', 's4', 'i1', '2025-09-09', 'hadir', 2, NULL),
  ('10777777-7777-4777-8777-777777777777', 'c1', 's2', 'i1', '2025-09-16', 'sakit', 3, 'Demam'),
  ('10888888-8888-4888-8888-888888888888', 'c1', 's3', 'i1', '2025-09-16', 'hadir', 3, NULL),
  ('10999999-9999-4999-8999-999999999999', 'c1', 's4', 'i1', '2025-09-16', 'hadir', 3, NULL),
  -- c2 (Matematika Diskrit) — 2 pertemuan, students s5,s6
  ('10aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c2', 's5', 'i2', '2025-09-03', 'hadir', 1, NULL),
  ('10bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'c2', 's6', 'i2', '2025-09-03', 'alpha', 1, NULL),
  ('10cccccc-cccc-4ccc-8ccc-cccccccccccc', 'c2', 's5', 'i2', '2025-09-10', 'hadir', 2, NULL),
  ('10dddddd-dddd-4ddd-8ddd-dddddddddddd', 'c2', 's6', 'i2', '2025-09-10', 'sakit', 2, 'Flu')
ON CONFLICT (id) DO NOTHING;
