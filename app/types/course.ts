/**
 * Course-related types for the application layer.
 */
import type { Course, Enrollment, Lesson, LessonProgress } from './database'

export interface CourseWithProgress extends Course {
  enrollment?: Enrollment
  lessonCount?: number
  completedLessons?: number
  progressPercent?: number
}

export interface LessonWithProgress extends Lesson {
  progress?: LessonProgress
}

export interface ClassRoster {
  level: number
  session_time: 'morning' | 'evening'
  label: string
}
