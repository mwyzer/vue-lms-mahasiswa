/**
 * useFileAttachment — Unit Tests
 *
 * Tests attachment validation, size formatting, filename derivation,
 * and demo-mode storage via the assignments store.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  useFileAttachment,
  ATTACHMENT_MAX_MB,
  STORAGE_MAX_MB,
  sanitizeFileName,
  buildStoragePath,
  parseStorageUrl,
} from '~/composables/useFileAttachment'
import { useUiStore } from '~/stores/ui'
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

// ── Supabase Storage helpers ──

describe('storage path helpers', () => {
  it('sanitizes filenames for use as object keys', () => {
    expect(sanitizeFileName('Laporan Akhir (final).pdf')).toBe('Laporan-Akhir-final.pdf')
    expect(sanitizeFileName('../../etc/passwd')).toBe('....etcpasswd')
    expect(sanitizeFileName('')).toBe('file')
  })

  it('builds {folder}/{scope}/{user}/{ts}-{name} paths', () => {
    const path = buildStoragePath({ folder: 'submissions', scopeId: 'a1' }, 'u-9', 'jawaban saya.py', 1700000000000)
    expect(path).toBe('submissions/a1/u-9/1700000000000-jawaban-saya.py')
    // The uploader ID must be the 3rd folder — the storage RLS policy depends on it.
    expect(path.split('/')[2]).toBe('u-9')
  })

  it('parses storage:// references and ignores other URLs', () => {
    expect(parseStorageUrl('storage://attachments/submissions/a1/u-9/1-x.py')).toEqual({
      bucket: 'attachments',
      path: 'submissions/a1/u-9/1-x.py',
    })
    expect(parseStorageUrl('https://example.com/x.pdf')).toBeNull()
    expect(parseStorageUrl('data:text/plain;base64,SGk=')).toBeNull()
    expect(parseStorageUrl('storage://attachments/')).toBeNull()
    expect(parseStorageUrl(null)).toBeNull()
  })

  it('derives the original filename from a storage reference', () => {
    const { fileNameFromUrl } = useFileAttachment()
    expect(fileNameFromUrl('storage://attachments/assignments/c1/i1/1700000000000-panduan.pdf')).toBe('panduan.pdf')
  })
})

describe('uploadAttachment / resolveFileUrl', () => {
  function makeStorageMock(result: { uploadError?: { message: string } | null; signedUrl?: string | null }) {
    const upload = vi.fn().mockResolvedValue({ data: {}, error: result.uploadError ?? null })
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: result.signedUrl ? { signedUrl: result.signedUrl } : null,
      error: result.signedUrl ? null : { message: 'not found' },
    })
    const from = vi.fn(() => ({ upload, createSignedUrl, remove: vi.fn() }))
    ;(globalThis as any).useNuxtApp = vi.fn(() => ({ $supabase: { storage: { from } } }))
    return { upload, createSignedUrl, from }
  }

  it('returns a base64 data URL in demo mode without touching Storage', async () => {
    const mock = makeStorageMock({})
    const { uploadAttachment, maxAttachmentMB } = useFileAttachment()
    const url = await uploadAttachment(makeFile('a.txt', 4), { folder: 'submissions', scopeId: 'a1' })
    expect(url.startsWith('data:')).toBe(true)
    expect(mock.upload).not.toHaveBeenCalled()
    expect(maxAttachmentMB.value).toBe(ATTACHMENT_MAX_MB)
  })

  it('uploads to the attachments bucket in production mode', async () => {
    useUiStore().demoModeOverride = false
    useAuthStore().user = { id: 'u-9', role: 'student', nama: 'Tes', created_at: '', updated_at: '' }
    const mock = makeStorageMock({})

    const { uploadAttachment, maxAttachmentMB, uploading } = useFileAttachment()
    expect(maxAttachmentMB.value).toBe(STORAGE_MAX_MB)

    const url = await uploadAttachment(makeFile('jawaban.py', 10, 'text/x-python'), { folder: 'submissions', scopeId: 'a1' })
    expect(mock.from).toHaveBeenCalledWith('attachments')
    expect(url).toMatch(/^storage:\/\/attachments\/submissions\/a1\/u-9\/\d+-jawaban\.py$/)
    expect(mock.upload.mock.calls[0][0]).toBe(url.replace('storage://attachments/', ''))
    expect(uploading.value).toBe(false)
  })

  it('throws a readable error when the upload fails', async () => {
    useUiStore().demoModeOverride = false
    useAuthStore().user = { id: 'u-9', role: 'student', nama: 'Tes', created_at: '', updated_at: '' }
    makeStorageMock({ uploadError: { message: 'Payload too large' } })

    const { uploadAttachment, uploading } = useFileAttachment()
    await expect(uploadAttachment(makeFile('x.zip', 10), { folder: 'submissions', scopeId: 'a1' }))
      .rejects.toThrow('Payload too large')
    expect(uploading.value).toBe(false)
  })

  it('resolves storage references to signed URLs and passes other URLs through', async () => {
    const mock = makeStorageMock({ signedUrl: 'https://signed.example/x?token=1' })
    const { resolveFileUrl } = useFileAttachment()

    expect(await resolveFileUrl('data:text/plain;base64,SGk=')).toBe('data:text/plain;base64,SGk=')
    expect(mock.createSignedUrl).not.toHaveBeenCalled()

    expect(await resolveFileUrl('storage://attachments/assignments/c1/i1/1-a.pdf', 'a.pdf'))
      .toBe('https://signed.example/x?token=1')
    expect(mock.createSignedUrl.mock.calls[0][0]).toBe('assignments/c1/i1/1-a.pdf')
  })

  it('returns null when a signed URL cannot be created', async () => {
    makeStorageMock({ signedUrl: null })
    const { resolveFileUrl } = useFileAttachment()
    expect(await resolveFileUrl('storage://attachments/assignments/c1/i1/1-a.pdf')).toBeNull()
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