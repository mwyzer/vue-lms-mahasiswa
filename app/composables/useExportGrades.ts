/**
 * useExportGrades — Composable for exporting assignment grades to Excel (.xlsx).
 * Uses the SheetJS (xlsx) library to generate workbook files client-side.
 */
import * as XLSX from 'xlsx'
import { useNotification } from './useNotification'

interface GradeRow {
  'No': number
  'NPM': string
  'Nama Mahasiswa': string
  'Tugas': string
  'Nilai': number | string
  'Feedback': string
  'Status': string
}

export function useExportGrades() {
  const notification = useNotification()

  /**
   * Export an array of grade records to Excel and trigger download.
   *
   * @param data - Array of grade rows
   * @param filename - Output filename (without extension)
   * @param sheetName - Sheet tab name
   */
  function exportToExcel(
    data: GradeRow[],
    filename: string = 'Nilai-Tugas',
    sheetName: string = 'Nilai',
  ) {
    try {
      if (data.length === 0) {
        notification.warning('Tidak ada data nilai untuk diekspor.')
        return
      }

      const ws = XLSX.utils.json_to_sheet(data)

      // Set column widths
      ws['!cols'] = [
        { wch: 4 },   // No
        { wch: 12 },  // NPM
        { wch: 25 },  // Nama
        { wch: 30 },  // Tugas
        { wch: 8 },   // Nilai
        { wch: 30 },  // Feedback
        { wch: 12 },  // Status
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, sheetName)

      // Generate buffer and trigger download
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([wbout], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      notification.success(`Berhasil mengekspor ${data.length} data nilai ke Excel!`)
    } catch (err) {
      console.error('Export error:', err)
      notification.error('Gagal mengekspor data nilai.')
    }
  }

  /**
   * Prepare grade data from submissions for export.
   */
  function prepareGradeData(
    submissions: Array<{
      student_name?: string
      student_npm?: string
      assignment_judul?: string
      nilai?: number | null
      feedback?: string | null
      submitted_at?: string | null
    }>,
  ): GradeRow[] {
    return submissions
      .filter(s => s.submitted_at) // Only graded/submitted ones
      .map((s, i) => ({
        'No': i + 1,
        'NPM': s.student_npm || '-',
        'Nama Mahasiswa': s.student_name || '-',
        'Tugas': s.assignment_judul || '-',
        'Nilai': s.nilai !== null && s.nilai !== undefined ? s.nilai : '-',
        'Feedback': s.feedback || '-',
        'Status': s.nilai !== null && s.nilai !== undefined
          ? (s.nilai >= 60 ? 'Lulus' : 'Tidak Lulus')
          : 'Belum Dinilai',
      }))
  }

  /**
   * Export grades for all assignments in a course.
   * Groups submissions by assignment.
   */
  function exportCourseGrades(
    courseName: string,
    assignments: Array<{ id: string; judul: string }>,
    getSubmissionsFn: (assignmentId: string) => Array<{
      student_name?: string
      student_npm?: string
      nilai?: number | null
      feedback?: string | null
      submitted_at?: string | null
    }>,
  ) {
    const allRows: GradeRow[] = []
    let rowNo = 0

    for (const assignment of assignments) {
      const subs = getSubmissionsFn(assignment.id)
      for (const s of subs) {
        if (!s.submitted_at) continue
        rowNo++
        allRows.push({
          'No': rowNo,
          'NPM': s.student_npm || '-',
          'Nama Mahasiswa': s.student_name || '-',
          'Tugas': assignment.judul,
          'Nilai': s.nilai !== null && s.nilai !== undefined ? s.nilai : '-',
          'Feedback': s.feedback || '-',
          'Status': s.nilai !== null && s.nilai !== undefined
            ? (s.nilai >= 60 ? 'Lulus' : 'Tidak Lulus')
            : 'Belum Dinilai',
        })
      }
    }

    const safeName = courseName.replace(/[^a-zA-Z0-9]/g, '_')
    exportToExcel(allRows, `Nilai-${safeName}`, courseName)
  }

  return {
    exportToExcel,
    prepareGradeData,
    exportCourseGrades,
  }
}
