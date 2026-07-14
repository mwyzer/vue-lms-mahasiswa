-- ============================================
-- LMS Mahasiswa — Seed Data
-- Instructors, Students, Courses, Enrollments
-- ============================================

-- ── Instructors ───────────────────────────────
INSERT INTO profiles (id, role, nama, email) VALUES
  ('i1', 'instructor', 'Dr. Andi Wijaya, M.Kom.', 'andi@lms.ac.id'),
  ('i2', 'instructor', 'Dr. Dewi Lestari, M.Pd.', 'dewi@lms.ac.id'),
  ('i3', 'instructor', 'Prof. Budi Hartono, Ph.D.', 'budi@lms.ac.id');

-- ── Students ──────────────────────────────────
INSERT INTO profiles (id, role, nama, npm, kelas, level, session_time) VALUES
  ('s1',  'student', 'Ahmad Fauzi',      '20241001', '1A', 1, 'morning'),
  ('s2',  'student', 'Budi Santoso',      '20241002', '1A', 1, 'morning'),
  ('s3',  'student', 'Citra Dewi',        '20241003', '1A', 1, 'morning'),
  ('s4',  'student', 'Dian Permata',      '20241004', '1B', 1, 'evening'),
  ('s5',  'student', 'Eka Putra',         '20241005', '1B', 1, 'evening'),
  ('s6',  'student', 'Fitri Handayani',   '20241006', '2A', 2, 'morning'),
  ('s7',  'student', 'Gilang Pratama',    '20241007', '2A', 2, 'morning'),
  ('s8',  'student', 'Hesti Wulandari',   '20241008', '2B', 2, 'evening'),
  ('s9',  'student', 'Irfan Hakim',       '20241009', '3A', 3, 'morning'),
  ('s10', 'student', 'Joko Susilo',       '20241010', '3A', 3, 'morning'),
  ('s11', 'student', 'Kartika Sari',      '20241011', '3B', 3, 'evening'),
  ('s12', 'student', 'Lintang Utami',     '20241012', '4A', 4, 'morning'),
  ('s13', 'student', 'Mega Puspita',      '20241013', '4A', 4, 'morning'),
  ('s14', 'student', 'Nanda Kusuma',      '20241014', '4B', 4, 'evening'),
  ('s15', 'student', 'Oscar Rafif',       '20241015', '4B', 4, 'evening');

-- ── Courses ───────────────────────────────────
INSERT INTO courses (id, instructor_id, kode, nama, deskripsi, level, session_time, color, icon) VALUES
  ('c1',  'i1', 'MK101', 'Pemrograman Dasar',                 'Belajar dasar-dasar pemrograman dengan Python.', 1, 'morning', '#3b82f6', '💻'),
  ('c2',  'i2', 'MK102', 'Matematika Diskrit',                'Konsep matematika untuk ilmu komputer.', 1, 'morning', '#8b5cf6', '🔢'),
  ('c3',  'i3', 'MK103', 'Logika Informatika',                'Logika proposisional dan predikat.', 1, 'evening', '#ec4899', '🧠'),
  ('c4',  'i1', 'MK104', 'Pengantar TI',                      'Pengantar Teknologi Informasi.', 1, 'evening', '#14b8a6', '🖥️'),
  ('c5',  'i1', 'MK201', 'Struktur Data',                     'Struktur data fundamental.', 2, 'morning', '#f59e0b', '📊'),
  ('c6',  'i2', 'MK202', 'Basis Data',                        'Konsep database SQL dan NoSQL.', 2, 'morning', '#10b981', '🗄️'),
  ('c7',  'i3', 'MK203', 'Pemrograman Web',                   'HTML, CSS, JavaScript.', 2, 'evening', '#ef4444', '🌐'),
  ('c8',  'i1', 'MK301', 'Pemrograman Berorientasi Objek',    'OOP dengan Java.', 3, 'morning', '#6366f1', '📦'),
  ('c9',  'i2', 'MK302', 'Analisis dan Desain Sistem',        'SDLC, UML, perancangan sistem.', 3, 'morning', '#a855f7', '📐'),
  ('c10', 'i3', 'MK303', 'Jaringan Komputer',                 'TCP/IP, routing, switching.', 3, 'evening', '#06b6d4', '🌐'),
  ('c11', 'i1', 'MK401', 'Rekayasa Perangkat Lunak',          'Metodologi pengembangan perangkat lunak.', 4, 'morning', '#84cc16', '🛠️'),
  ('c12', 'i2', 'MK402', 'Kecerdasan Buatan',                 'Machine learning, NLP, AI.', 4, 'morning', '#f97316', '🤖'),
  ('c13', 'i3', 'MK403', 'Keamanan Informasi',                'Kriptografi, ethical hacking.', 4, 'evening', '#dc2626', '🔒');

-- ── Enrollments ───────────────────────────────
INSERT INTO enrollments (student_id, course_id) VALUES
  ('s1',  'c1'), ('s1',  'c2'),
  ('s2',  'c1'), ('s2',  'c2'),
  ('s3',  'c1'), ('s3',  'c2'),
  ('s4',  'c3'), ('s4',  'c4'),
  ('s5',  'c3'), ('s5',  'c4'),
  ('s6',  'c5'), ('s6',  'c6'),
  ('s7',  'c5'), ('s7',  'c6'),
  ('s8',  'c7'),
  ('s9',  'c8'), ('s9',  'c9'),
  ('s10', 'c8'), ('s10', 'c9'),
  ('s11', 'c10'),
  ('s12', 'c11'), ('s12', 'c12'),
  ('s13', 'c11'), ('s13', 'c12'),
  ('s14', 'c13'),
  ('s15', 'c13');

-- ── Lessons (sample) ─────────────────────────
INSERT INTO lessons (id, course_id, judul, konten, urutan) VALUES
  ('l1', 'c1', 'Pengantar Pemrograman',  'Apa itu pemrograman?', 1),
  ('l2', 'c1', 'Variabel dan Tipe Data', 'Mengenal variabel dan tipe data.', 2),
  ('l3', 'c1', 'Percabangan (If-Else)',  'Logika percabangan.', 3),
  ('l4', 'c1', 'Perulangan (Looping)',   'For, while, do-while.', 4);

-- ── Assignments (sample) ─────────────────────
INSERT INTO assignments (id, course_id, instructor_id, judul, deskripsi, tenggat_waktu) VALUES
  ('a1', 'c1', 'i1', 'Tugas 1: Hello World',       'Buat program Hello World dalam Python.',       NOW() + INTERVAL '7 days'),
  ('a2', 'c1', 'i1', 'Tugas 2: Kalkulator',         'Buat kalkulator sederhana.',                   NOW() + INTERVAL '14 days'),
  ('a3', 'c2', 'i2', 'Tugas 1: Diagram Venn',       'Buat diagram Venn dari 3 himpunan.',           NOW() + INTERVAL '10 days');
