/**
 * Roster types for student/instructor roster data used in login flows.
 */

export interface StudentRosterEntry {
  id: string
  nama: string
  npm: string
  kelas: string
  level: number
  session_time: 'morning' | 'evening'
}

export interface InstructorEntry {
  id: string
  nama: string
  email?: string | null
}

export interface AdminEntry {
  id: string
  nama: string
  email?: string | null
}

export interface LoginCredentials {
  role: 'student' | 'instructor' | 'admin'
  nama: string
  npm?: string
  password?: string // only for instructors and admins
}
