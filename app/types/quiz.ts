/**
 * Quiz-related types for the application layer.
 */
import type { Quiz, QuizQuestion, QuizAnswer } from './database'

export interface QuizWithCourse extends Quiz {
  course_name?: string
  course_kode?: string
  questionCount?: number
  submittedAt?: string | null
  score?: number | null
}

export interface QuizQuestionWithOptions extends QuizQuestion {
  options: string[]
}

export interface QuizResult {
  quizId: string
  studentId: string
  answers: Record<string, number> // questionId -> selectedOptionIndex
  score: number
  totalQuestions: number
  percentage: number
  submittedAt: string
}
