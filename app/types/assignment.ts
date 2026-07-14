/**
 * Assignment-related types for the application layer.
 */
import type { Assignment, Submission } from './database'

export interface AssignmentWithCourse extends Assignment {
  course_name?: string
  course_kode?: string
  submission?: Submission
}

export interface SubmissionWithStudent extends Submission {
  student_name?: string
  student_npm?: string
}
