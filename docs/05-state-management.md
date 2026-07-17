# Bagian 5: State Management (Pinia)

## Auth Store (§14.1)

### State
```ts
user: User | null
profile: Profile | null
loading: boolean
error: string | null
initialized: boolean
role: 'mahasiswa' | 'instruktur' | 'admin' | null
classList: ClassRoster[]     // Daftar kelas untuk dropdown login
studentRoster: StudentInfo[]  // Daftar mahasiswa per kelas
instructorList: Instructor[]  // Daftar instruktur
selectedLevel: number | null
selectedSession: string | null
demoMode: boolean             // true jika Supabase tidak dikonfigurasi
```

### Actions
```ts
initializeAuth()              // Cek session tersimpan
fetchClassList()              // Ambil daftar kelas (level + session)
fetchStudentRoster(level, session)  // Ambil daftar mahasiswa per kelas
fetchInstructorList()         // Ambil daftar instruktur
loginAsStudent(studentId)     // Login sebagai mahasiswa (by NPM/ID)
loginAsInstructor(instructorId)  // Login sebagai instruktur
logout()
fetchProfile()
updateProfile(data)
```

### Getters
```ts
isAuthenticated        // boolean
isStudent              // boolean (role === 'mahasiswa')
isInstructor           // boolean (role === 'instruktur')
userName               // string
userInitials           // string (untuk avatar)
dashboardRoute         // string: '/dashboard' atau '/instructor/dashboard'
```

---

## Course Store (§14.2)

### State
```ts
myCourses: CourseWithProgress[]   // Courses with progress info
selectedCourse: Course | null
lessons: LessonWithProgress[]     // Lessons with completion status
loading: boolean
error: string | null
searchQuery: string
```

### Actions
```ts
init()                                   // Fetch courses + enrollments
fetchLessons(courseId)                   // Ambil lesson list + progress
toggleLessonCompleted(lessonId)          // Toggle complete/uncomplete
```

### Getters
```ts
filteredCourses      // berdasarkan searchQuery
courseProgress       // Map courseId → %
completedLessons     // Set lessonId
```

---

## Assignment Store (§14.3)

### State
```ts
myAssignments: AssignmentWithCourse[]   // Assignments with course info
selectedAssignment: Assignment | null
mySubmissions: Submission[]             // Current user's submissions
loading: boolean
error: string | null
statusFilter: string
```

### Actions
```ts
init()                                   // Fetch assignments
fetchAssignmentById(id)                  // Ambil detail tugas
fetchSubmission(assignmentId)            // Ambil submission milik sendiri
submitAssignment(assignmentId, data)     // Submit jawaban
updateSubmission(assignmentId, data)     // Update submission
```

### Getters
```ts
pendingAssignments    // Not Submitted + Late
gradedAssignments     // Sudah dinilai
overdueAssignments    // Lewat deadline
```

---

## UI Store (§14.4)

### State
```ts
sidebarOpen: boolean
toast: { message: string, type: string } | null
theme: 'light' | 'dark'
```

### Actions
```ts
toggleSidebar()
showToast(message, type)
hideToast()
```

---

## Calendar Store (§14.5)

### State
```ts
events: AcademicEvent[]
loading: boolean
error: string | null
demoVersion: number
```

### Actions
```ts
init()                                // Fetch events (Supabase or demo data)
```

### Getters
```ts
allEvents              // All academic events sorted by date
todayEvents            // Events happening today
upcomingEvents         // Future events
eventsByMonth(year, month)  // Events in a specific month
```

---

## Attendance Store (§14.6)

### State
```ts
records: AttendanceWithNames[]  // Full attendance with student/course names
loading: boolean
error: string | null
demoVersion: number
isDemoMode: boolean
initialized: boolean
sbRecords: Attendance[]         // Supabase records
```

### Actions
```ts
init()                                                // Init store (check demo mode, fetch)
setAttendance(data)                                   // Upsert attendance record (create or update)
getOrCreateMeetingAttendance(courseId, pertemuan, tanggal)  // Get records for all students, fill defaults for missing
```

### Getters
```ts
allRecords                              // All records with student_name, student_npm, course_name
recordsByCourse(courseId)               // Filter by course
recordsByStudent(studentId)             // Filter by student
recordsByMeeting(courseId, pertemuan)   // Filter by course + meeting
recordsByDate(courseId, tanggal)        // Filter by course + date
totalMeetings(courseId)                 // Number of unique pertemuan for a course
studentStats(studentId, courseId)       // { total, hadir, izin, sakit, alpha, persentase }
```
