/**
 * useFileAttachment — Unit Tests
 *
 * Tests attachment validation, size formatting, filename derivation,
 * and demo-mode storage via the assignments store.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useFileAttachment, ATTACHMENT_MAX_MB } from '~/composables/useFileAttachment'
import { useAssignmentsStore } from '~/stores/assignments'
import { useAuthStore } from '~/stores/auth'
import { useCoursesStore } from '~/stores/courses'

function makeFile(name: string, size: number, type = 'text/plain'): File {
  return new File([new Uint8Array(size)], name, { type })
}

async function initAllStores(): Promise<void> {
  await useAuthStore().init()
  await useCoursesStore().init()
  await useAssignmentsStore().init()
}

describe('useFileAttachment', () => {
  const { validateAttachmentFile, formatFileSize, fileNameFromUrl } = useFileAttachment()

  it('accepts a file within the size limit', () => {
    const file = makeFile('jawaban.py', 1024, 'text/x-python')
    expect(validateAttachmentFile(file)).toBeNull()
  })

  it('rejects an empty file', () => {
    const file = makeFile('kosong.py', 0)
    expect(validateAttachmentFile(file)).toContain('kosong')
  })

  it('rejects a file over the size limit', () => {
    const file = makeFile('besar.zip', (ATTACHMENT_MAX_MB * 1024 * 1024) + 1, 'application/zip')
    expect(validateAttachmentFile(file)).toContain(String(ATTACHMENT_MAX_MB))
  })

  it('formats byte counts', () => {
    expect(formatFileSize(0)).toBe('')
    expect(formatFileSize(500)).toBe('500 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB')
  })

  it('derives a filename from a URL path', () => {
    expect(fileNameFromUrl('https://cdn.supabase.co/storage/v1/object/public/bucket/panduan.pdf')).toBe('panduan.pdf')
    expect(fileNameFromUrl('data:text/plain;base64,SGk=', 'lampiran')).toBe('lampiran')
  })
})

// ── Store integration (demo mode) ──

describe('assignments store attachment handling', () => {
  beforeEach(async () => {
    await initAllStores()
  })

  it('keeps the demo assignment attachment on a1', async () => {
    const store = useAssignmentsStore()
    const a1 = store.assignments.find((a) => a.id === 'a1')
    expect(a1?.file_url).toBeTruthy()
    expect(a1?.file_name).toBe('panduan-tugas1.txt')
  })

  it('stores a file attachment when submitting a submission', async () => {
    const auth = useAuthStore()
    await auth.loginAsStudent('Citra Dewi', '20241003', 'mahasiswa123')
    const store = useAssignmentsStore()

    const url = 'data:text/python;base64,cHJpbnQoImhpIik='
    await store.submitAssignment('a3', 'Diagram Venn', { url, name: 'venn.py' })

    const assignments = store.myAssignments as any[]
    const a3 = assignments.find((a: any) => a.id === 'a3')
    expect(a3?.submission?.file_url).toBe(url)
    expect(a3?.submission?.file_name).toBe('venn.py')
  })

  it('creates a submission from a file alone (no text)', async () => {
    const auth = useAuthStore()
    await auth.loginAsStudent('Citra Dewi', '20241003', 'mahasiswa123')
    const store = useAssignmentsStore()

    await store.submitAssignment('a2', '', { url: 'data:application/pdf;base64,AAAA', name: 'laporan.pdf' })

    const assignments = store.myAssignments as any[]
    const a2 = assignments.find((a: any) => a.id === 'a2')
    expect(a2?.submission).toBeDefined()
    expect(a2?.submission?.jawaban).toBe('')
    expect(a2?.submission?.file_name).toBe('laporan.pdf')
  })

  it('updates an existing submission and replaces the attachment', async () => {
    const auth = useAuthStore()
    // s2 already has a submission for a1 with file hello.py
    await auth.loginAsStudent('Budi Santoso', '20241002', 'mahasiswa123')
    const store = useAssignmentsStore()

    await store.submitAssignment('a1', 'updated', { url: 'data:text/python;base64,cHJpbnQoIngiKQ==', name: 'v2.py' })

    const assignments = store.myAssignments as any[]
    const a1 = assignments.find((a: any) => a.id === 'a1')
    expect(a1?.submission?.jawaban).toBe('updated')
    expect(a1?.submission?.file_name).toBe('v2.py')
    expect(a1?.submission?.file_url).toContain('data:text/python')
  })

  it('adds an assignment with a file attachment', async () => {
    const auth = useAuthStore()
    await auth.loginAsInstructor('Dr. Andi Wijaya', 'instruktur123')
    const store = useAssignmentsStore()

    await store.addAssignment('c1', 'Tugas Lampiran', 'Deskripsi', '2026-12-31T23:59:59Z', undefined, {
      url: 'data:application/pdf;base64,QUJD',
      name: 'materi.pdf',
    })

    const assignments = store.myAssignments as any[]
    const added = assignments.find((a: any) => a.judul === 'Tugas Lampiran')
    expect(added).toBeDefined()
    expect(added?.file_name).toBe('materi.pdf')
    expect(added?.file_url).toContain('data:application/pdf')
  })

  it('updates an assignment and sets/replaces its attachment', async () => {
    const auth = useAuthStore()
    await auth.loginAsInstructor('Dr. Andi Wijaya', 'instruktur123')
    const store = useAssignmentsStore()

    await store.updateAssignment('a1', {
      file: { url: 'data:text/plain;base64,VkVSU0k=', name: 'panduan-v2.txt' },
    })

    const a1 = store.assignments.find((a) => a.id === 'a1')
    expect(a1?.file_name).toBe('panduan-v2.txt')
    expect(a1?.file_url).toContain('data:text/plain')

    // Reverting attachment: null clears it
    await store.updateAssignment('a1', { file: null })
    const a1Clear = store.assignments.find((a) => a.id === 'a1')
    expect(a1Clear?.file_url).toBeNull()
    expect(a1Clear?.file_name).toBeNull()
  })
})