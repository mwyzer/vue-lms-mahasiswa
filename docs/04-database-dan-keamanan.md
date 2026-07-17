# Bagian 4: Database & Keamanan

## Database Schema (§12)

### 1. profiles
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK, terhubung ke auth.users.id |
| role | text | 'student' / 'instructor' / 'admin' |
| nama | text | Nama lengkap |
| npm | text | NIM/NPM mahasiswa |
| kelas | text | Kelas mahasiswa |
| level | integer | Level: 1–4 |
| session_time | text | 'morning' / 'evening' |
| email | text | |
| avatar_url | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 2. courses
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| instructor_id | uuid | FK → profiles.id (role = 'instruktur') |
| kode | text | Kode MK (contoh: MK101) |
| nama | text | Nama mata kuliah |
| deskripsi | text | |
| level | integer | Level kelas: 1, 2, 3, atau 4 |
| session_time | text | Waktu: 'morning' / 'evening' |
| color | text | Warna card (hex) |
| icon | text | Emoji icon |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Ketentuan:**
- `level` hanya bernilai 1–4
- `session_time` hanya 'morning' atau 'evening'
- `instructor_id` merujuk ke profil dengan role 'instruktur'

### 3. enrollments
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| student_id | uuid | FK → profiles.id |
| course_id | uuid | FK → courses.id |
| enrolled_at | timestamptz | |
| status | text | active / completed / cancelled |

**Unique constraint:** (student_id, course_id)

### 4. lessons
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| course_id | uuid | FK → courses.id |
| judul | text | Judul materi |
| konten | text | Isi materi |
| urutan | integer | Urutan materi |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 5. lesson_progress
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| student_id | uuid | FK → profiles.id |
| lesson_id | uuid | FK → lessons.id |
| completed | boolean | |
| completed_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Unique constraint:** (student_id, lesson_id)

### 6. assignments
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| course_id | uuid | FK → courses.id |
| instructor_id | uuid | FK → profiles.id |
| judul | text | Judul tugas |
| deskripsi | text | Instruksi tugas |
| tenggat_waktu | timestamptz | Deadline |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 7. submissions
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| assignment_id | uuid | FK → assignments.id |
| student_id | uuid | FK → profiles.id |
| jawaban | text | Jawaban teks |
| submitted_at | timestamptz | |
| nilai | integer | Score |
| feedback | text | |
| graded_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Unique constraint:** (assignment_id, student_id)

### 8. academic_events
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| course_id | uuid | FK → courses.id (nullable) |
| judul | text | Nama event |
| deskripsi | text | Deskripsi event |
| tipe | text | 'uts' / 'uas' / 'tugas' / 'libur' / 'acara' |
| tanggal_mulai | timestamptz | Waktu mulai |
| tanggal_selesai | timestamptz | Waktu selesai (nullable) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 9. attendance
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| course_id | uuid | FK → courses.id (ON DELETE CASCADE) |
| student_id | uuid | FK → profiles.id (ON DELETE CASCADE) |
| instructor_id | uuid | FK → profiles.id (ON DELETE CASCADE) |
| tanggal | date | Tanggal pertemuan |
| status | text | 'hadir' / 'izin' / 'sakit' / 'alpha' — CHECK constraint |
| pertemuan | integer | Nomor pertemuan |
| keterangan | text | Catatan tambahan (nullable) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Unique constraint:** (course_id, student_id, pertemuan)
**Indexes:** idx_attendance_course, idx_attendance_student

### announcements
_Pengumuman belum diimplementasikan — akan ditambahkan di versi mendatang._

---

## Row Level Security (§13)

### profiles
- ✅ Semua role: Baca profil sendiri
- ✅ Update profil sendiri
- ✅ Admin: Baca semua profil
- ❌ Ubah role atau ID

### enrollments
- ✅ Baca enrollment milik sendiri
- ❌ Mendaftarkan diri langsung
- ❌ Ubah enrollment
- ❌ Lihat enrollment mahasiswa lain

### courses
- ✅ Mahasiswa: Baca mata kuliah published yang diikuti
- ✅ Instruktur: Baca, buat, update, hapus mata kuliah yang diampu (instructor_id = auth.uid)

### lessons
- ✅ Mahasiswa: Baca materi published dari MK yang diikuti
- ✅ Instruktur: Baca, buat, update, hapus materi dari MK yang diampu

### lesson_progress
- ✅ Baca progress sendiri
- ✅ Buat progress sendiri
- ✅ Update progress sendiri

### assignments
- ✅ Mahasiswa: Baca tugas published dari MK yang diikuti
- ✅ Instruktur: Baca, buat, update, hapus tugas dari MK yang diampu

### submissions
- ✅ Mahasiswa: Baca submission sendiri
- ✅ Mahasiswa: Buat submission sendiri
- ✅ Mahasiswa: Update submission sendiri (belum dinilai)
- ❌ Mahasiswa: Ubah nilai/feedback
- ❌ Mahasiswa: Lihat submission mahasiswa lain
- ✅ Instruktur: Baca submission dari MK yang diampu
- ✅ Instruktur: Update score dan feedback

### academic_events
- ✅ Semua role login: Baca semua event
- ❌ Ubah, buat, hapus event (dari seed saja)

### attendance
- ✅ Instruktur: Baca, buat, dan update presensi di MK yang diampu
- ✅ Mahasiswa: Baca presensi milik sendiri
- ❌ Mahasiswa: Ubah presensi
- ❌ Lihat presensi mahasiswa lain
