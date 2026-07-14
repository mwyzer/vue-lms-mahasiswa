# Bagian 5: State Management (Pinia)

## Auth Store (§14.1)

### State
```ts
user: User | null
profile: Profile | null
loading: boolean
error: string | null
initialized: boolean
role: 'mahasiswa' | 'instruktur' | null
classList: ClassRoster[]     // Daftar kelas untuk dropdown login
studentRoster: StudentInfo[]  // Daftar mahasiswa per kelas
instructorList: Instructor[]  // Daftar instruktur
selectedLevel: number | null
selectedSession: string | null
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
courses: Course[]
selectedCourse: Course | null
lessons: Lesson[]
progress: Map<string, number>  // courseId → %
loading: boolean
error: string | null
searchQuery: string
```

### Actions
```ts
fetchCourses()
fetchCourseById(id)
fetchLessons(courseId)
markLessonComplete(lessonId, courseId)
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
assignments: Assignment[]
selectedAssignment: Assignment | null
submissions: Submission[]
loading: boolean
error: string | null
statusFilter: string
```

### Actions
```ts
fetchAssignments()
fetchAssignmentById(id)
fetchSubmission(assignmentId)
submitAssignment(assignmentId, data)
updateSubmission(assignmentId, data)
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
