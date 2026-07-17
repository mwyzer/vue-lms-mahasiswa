/**
 * Calendar-related types for the application layer.
 */
import type { AcademicEvent } from './database'

export interface AcademicEventWithCourse extends AcademicEvent {
  course_name?: string
  course_kode?: string
}

export type CalendarViewType = 'month' | 'list' | 'timeline'
