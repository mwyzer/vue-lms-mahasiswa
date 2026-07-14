# Bagian 4: Database & Keamanan

## Database Schema (§12)

### 1. profiles
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK, terhubung ke auth.users.id |
| full_name | text | |
| email | text | |
| student_number | text | NIM |
| study_program | text | Program studi |
| entry_year | text | Angkatan |
| avatar_url | text | |
| bio | text | |
| role | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 2. courses
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| code | text | Kode MK |
| title | text | |
| description | text | |
| lecturer_name | text | Nama dosen (display) |
| instructor_id | uuid | FK → profiles.id (role = 'instruktur') |
| level | integer | Level kelas: 1, 2, 3, atau 4 |
| session_time | text | Waktu: 'morning' / 'evening' |
| semester | text | |
| credits | integer | SKS |
| cover_url | text | |
| status | text | draft / published / archived |
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
| title | text | |
| content | text | |
| video_url | text | |
| file_url | text | |
| sort_order | integer | |
| is_published | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 5. lesson_progress
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| student_id | uuid | FK → profiles.id |
| lesson_id | uuid | FK → lessons.id |
| is_completed | boolean | |
| completed_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Unique constraint:** (student_id, lesson_id)

### 6. assignments
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| course_id | uuid | FK → courses.id |
| title | text | |
| description | text | |
| due_date | timestamptz | |
| maximum_score | integer | |
| attachment_url | text | |
| is_published | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 7. submissions
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| assignment_id | uuid | FK → assignments.id |
| student_id | uuid | FK → profiles.id |
| answer_text | text | |
| submission_url | text | |
| submitted_at | timestamptz | |
| status | text | draft / submitted / late / graded |
| score | integer | |
| feedback | text | |
| graded_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Unique constraint:** (assignment_id, student_id)

### 8. announcements
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | uuid | PK |
| course_id | uuid | FK → courses.id (nullable untuk umum) |
| title | text | |
| content | text | |
| published_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## Row Level Security (§13)

### profiles
- ✅ Baca profil sendiri
- ✅ Update profil sendiri
- ❌ Baca profil mahasiswa lain
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
