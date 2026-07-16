-- ============================================
-- LMS Mahasiswa — Seed Data
-- ============================================
-- Convention:
--   Demo accounts (is_demo=TRUE)  → short IDs (s1..s15, i1..i3, a1)
--     Photos stored in localStorage (app-level demo mode)
--   Real accounts (is_demo=FALSE) → proper UUIDs
--     Photos stored in Supabase DB (avatar_url column)
-- ============================================

-- ============================================
-- A. DEMO ACCOUNTS  (is_demo = TRUE)
--    Match the hardcoded arrays in auth.ts.
--    Used when the app runs in demo mode
--    (VITE_DEMO_MODE=true).
-- ============================================

-- ── Demo: Instructors ────────────────────────
INSERT INTO profiles (id, role, nama, email, is_demo) VALUES
  ('i1', 'instructor', 'Dr. Andi Wijaya, M.Kom.',   'andi@lms.ac.id',    TRUE),
  ('i2', 'instructor', 'Dr. Dewi Lestari, M.Pd.',   'dewi@lms.ac.id',    TRUE),
  ('i3', 'instructor', 'Prof. Budi Hartono, Ph.D.', 'budi@lms.ac.id',    TRUE);

-- ── Demo: Admin ──────────────────────────────
INSERT INTO profiles (id, role, nama, email, is_demo) VALUES
  ('a1', 'admin', 'Admin LMS', 'admin@lms.ac.id', TRUE);

-- ── Demo: Students ───────────────────────────
INSERT INTO profiles (id, role, nama, npm, kelas, level, session_time, is_demo) VALUES
  ('s1',  'student', 'Ahmad Fauzi',      '20241001', '1A', 1, 'morning', TRUE),
  ('s2',  'student', 'Budi Santoso',      '20241002', '1A', 1, 'morning', TRUE),
  ('s3',  'student', 'Citra Dewi',        '20241003', '1A', 1, 'morning', TRUE),
  ('s4',  'student', 'Dian Permata',      '20241004', '1B', 1, 'evening', TRUE),
  ('s5',  'student', 'Eka Putra',         '20241005', '1B', 1, 'evening', TRUE),
  ('s6',  'student', 'Fitri Handayani',   '20241006', '2A', 2, 'morning', TRUE),
  ('s7',  'student', 'Gilang Pratama',    '20241007', '2A', 2, 'morning', TRUE),
  ('s8',  'student', 'Hesti Wulandari',   '20241008', '2B', 2, 'evening', TRUE),
  ('s9',  'student', 'Irfan Hakim',       '20241009', '3A', 3, 'morning', TRUE),
  ('s10', 'student', 'Joko Susilo',       '20241010', '3A', 3, 'morning', TRUE),
  ('s11', 'student', 'Kartika Sari',      '20241011', '3B', 3, 'evening', TRUE),
  ('s12', 'student', 'Lintang Utami',     '20241012', '4A', 4, 'morning', TRUE),
  ('s13', 'student', 'Mega Puspita',      '20241013', '4A', 4, 'morning', TRUE),
  ('s14', 'student', 'Nanda Kusuma',      '20241014', '4B', 4, 'evening', TRUE),
  ('s15', 'student', 'Oscar Rafif',       '20241015', '4B', 4, 'evening', TRUE);

-- ── Demo: Courses ────────────────────────────
INSERT INTO courses (id, instructor_id, kode, nama, deskripsi, level, session_time, color, icon) VALUES
  ('c1',  'i1', 'MK101', 'Pemrograman Dasar',                 'Belajar dasar-dasar pemrograman dengan Python.', 1, 'morning', '#3b82f6', '💻'),
  ('c2',  'i2', 'MK102', 'Matematika Diskrit',                'Konsep matematika untuk ilmu komputer.',          1, 'morning', '#8b5cf6', '🔢'),
  ('c3',  'i3', 'MK103', 'Logika Informatika',                'Logika proposisional dan predikat.',               1, 'evening', '#ec4899', '🧠'),
  ('c4',  'i1', 'MK104', 'Pengantar TI',                      'Pengantar Teknologi Informasi.',                   1, 'evening', '#14b8a6', '🖥️'),
  ('c5',  'i1', 'MK201', 'Struktur Data',                     'Struktur data fundamental.',                       2, 'morning', '#f59e0b', '📊'),
  ('c6',  'i2', 'MK202', 'Basis Data',                        'Konsep database SQL dan NoSQL.',                   2, 'morning', '#10b981', '🗄️'),
  ('c7',  'i3', 'MK203', 'Pemrograman Web',                   'HTML, CSS, JavaScript.',                           2, 'evening', '#ef4444', '🌐'),
  ('c8',  'i1', 'MK301', 'Pemrograman Berorientasi Objek',    'OOP dengan Java.',                                 3, 'morning', '#6366f1', '📦'),
  ('c9',  'i2', 'MK302', 'Analisis dan Desain Sistem',        'SDLC, UML, perancangan sistem.',                   3, 'morning', '#a855f7', '📐'),
  ('c10', 'i3', 'MK303', 'Jaringan Komputer',                 'TCP/IP, routing, switching.',                      3, 'evening', '#06b6d4', '🌐'),
  ('c11', 'i1', 'MK401', 'Rekayasa Perangkat Lunak',          'Metodologi pengembangan perangkat lunak.',         4, 'morning', '#84cc16', '🛠️'),
  ('c12', 'i2', 'MK402', 'Kecerdasan Buatan',                 'Machine learning, NLP, AI.',                       4, 'morning', '#f97316', '🤖'),
  ('c13', 'i3', 'MK403', 'Keamanan Informasi',                'Kriptografi, ethical hacking.',                    4, 'evening', '#dc2626', '🔒');

-- ── Demo: Enrollments ────────────────────────
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

-- ── Demo: Lessons ────────────────────────────
INSERT INTO lessons (id, course_id, judul, konten, urutan) VALUES
  ('l1', 'c1', 'Pengantar Pemrograman',  'Apa itu pemrograman?', 1),
  ('l2', 'c1', 'Variabel dan Tipe Data', 'Mengenal variabel dan tipe data.', 2),
  ('l3', 'c1', 'Percabangan (If-Else)',  'Logika percabangan.', 3),
  ('l4', 'c1', 'Perulangan (Looping)',   'For, while, do-while.', 4);

-- ── Demo: Assignments ────────────────────────
INSERT INTO assignments (id, course_id, instructor_id, judul, deskripsi, tenggat_waktu) VALUES
  ('a1', 'c1', 'i1', 'Tugas 1: Hello World',       'Buat program Hello World dalam Python.',       NOW() + INTERVAL '7 days'),
  ('a2', 'c1', 'i1', 'Tugas 2: Kalkulator',         'Buat kalkulator sederhana.',                   NOW() + INTERVAL '14 days'),
  ('a3', 'c2', 'i2', 'Tugas 1: Diagram Venn',       'Buat diagram Venn dari 3 himpunan.',           NOW() + INTERVAL '10 days');


-- ============================================
-- B. REAL ACCOUNTS  (is_demo = FALSE)
--    Production accounts stored in Supabase DB.
--    Photos for these accounts are saved to
--    the database (avatar_url column) rather
--    than localStorage.
-- ============================================

-- ── Real: Instructors ────────────────────────
INSERT INTO profiles (id, role, nama, email, is_demo) VALUES
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'instructor', 'Dr. Rina Marlina, S.Kom., M.TI.',  'rina@lms.ac.id',       FALSE),
  ('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 'instructor', 'Dr. Hendra Gunawan, M.Eng.',       'hendra@lms.ac.id',     FALSE),
  ('550e8400-e29b-41d4-a716-446655440000', 'instructor', 'Prof. Siti Rahmawati, Ph.D.',       'siti@lms.ac.id',       FALSE);

-- ── Real: Admin ──────────────────────────────
INSERT INTO profiles (id, role, nama, email, is_demo) VALUES
  ('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'admin', 'Super Admin LMS', 'superadmin@lms.ac.id', FALSE);

-- ── Real: Students ───────────────────────────
INSERT INTO profiles (id, role, nama, npm, kelas, level, session_time, is_demo) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'student', 'Aditya Pratama',     '20242001', '1A', 1, 'morning', FALSE),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'student', 'Bayu Aji Saputra',   '20242002', '1A', 1, 'morning', FALSE),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'student', 'Cindy Permata Sari', '20242003', '1B', 1, 'evening', FALSE),
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'student', 'Dimas Ardiansyah',    '20242004', '2A', 2, 'morning', FALSE),
  ('e5f6a7b8-c9d0-1234-efab-345678901234', 'student', 'Elsa Febriyanti',     '20242005', '2B', 2, 'evening', FALSE),
  ('f6a7b8c9-d0e1-2345-fabc-456789012345', 'student', 'Fajar Ramadhan',      '20242006', '3A', 3, 'morning', FALSE);

-- ── Real: Courses ────────────────────────────
INSERT INTO courses (id, instructor_id, kode, nama, deskripsi, level, session_time, color, icon) VALUES
  ('c101', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'MK501', 'Pembelajaran Mesin',      'Pengantar machine learning dengan Python.',        3, 'morning', '#7c3aed', '🤖'),
  ('c102', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 'MK502', 'Sistem Terdistribusi',   'Konsep sistem terdistribusi dan cloud computing.', 4, 'morning', '#0891b2', '☁️'),
  ('c103', '550e8400-e29b-41d4-a716-446655440000', 'MK503', 'Pemrosesan Citra Digital', 'Teknik pemrosesan dan analisis citra.',            3, 'evening', '#d946ef', '🖼️');

-- ── Real: Enrollments ────────────────────────
INSERT INTO enrollments (student_id, course_id) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'c101'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'c101'),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'c102'),
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'c102'),
  ('e5f6a7b8-c9d0-1234-efab-345678901234', 'c103'),
  ('f6a7b8c9-d0e1-2345-fabc-456789012345', 'c103');

-- ── Real: Lessons ────────────────────────────
INSERT INTO lessons (id, course_id, judul, konten, urutan) VALUES
  ('l101', 'c101', 'Pengantar Machine Learning', 'Apa itu ML? supervised vs unsupervised.', 1),
  ('l102', 'c101', 'Regresi Linear',             'Konsep regresi linear dan implementasi.',  2),
  ('l103', 'c102', 'Arsitektur Microservices',   'Pola arsitektur microservices.',           1),
  ('l104', 'c103', 'Pengolahan Citra',           'Dasar-dasar pengolahan citra digital.',    1);

-- ── Real: Assignments ────────────────────────
INSERT INTO assignments (id, course_id, instructor_id, judul, deskripsi, tenggat_waktu) VALUES
  ('a101', 'c101', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Tugas 1: Klasifikasi',  'Buat model klasifikasi sederhana dengan Scikit-Learn.', NOW() + INTERVAL '14 days'),
  ('a102', 'c102', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 'Tugas 1: REST API',     'Buat REST API sederhana dengan Node.js.',                NOW() + INTERVAL '10 days');
