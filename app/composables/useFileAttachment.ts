/**
 * useFileAttachment — File attachment helpers for assignments & submissions.
 *
 * Two storage backends, chosen by demo mode:
 * - Demo mode: file is read into a base64 data URL and kept in the Pinia store (max 2 MB).
 * - Production: file is uploaded to the private Supabase Storage bucket `attachments`
 *   (max 20 MB). `file_url` then holds a `storage://attachments/<path>` reference and a
 *   short-lived signed URL is created when the user downloads it.
 *
 * Also provides:
 * - attachment size validation with a friendly message
 * - byte count formatting for display
 * - client-side download for data:, http(s): and storage:// URLs
 * - display filename derivation from a URL
 */

/** Maximum attachment size in megabytes for demo mode (base64 in memory). */
export const ATTACHMENT_MAX_MB = 2
export const ATTACHMENT_MAX_BYTES = ATTACHMENT_MAX_MB * 1024 * 1024

/** Maximum attachment size in megabytes when uploading to Supabase Storage. */
export const STORAGE_MAX_MB = 20

export const ATTACHMENT_BUCKET = 'attachments'
export const STORAGE_URL_PREFIX = 'storage://'

/** Lifetime of a signed download URL, in seconds. */
const SIGNED_URL_TTL = 60 * 5

export type AttachmentFolder = 'assignments' | 'submissions'

export interface UploadTarget {
  /** Top-level folder: `assignments` (instructor brief) or `submissions` (student answer). */
  folder: AttachmentFolder
  /** Course ID (for assignments) or assignment ID (for submissions). */
  scopeId: string
}

/** Make a filename safe for use as a storage object key. */
export function sanitizeFileName(name: string): string {
  const cleaned = String(name ?? '')
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(-120)
  return cleaned || 'file'
}

/** Build the object key: `{folder}/{scopeId}/{userId}/{timestamp}-{filename}`. */
export function buildStoragePath(target: UploadTarget, userId: string, fileName: string, now = Date.now()): string {
  return `${target.folder}/${target.scopeId}/${userId}/${now}-${sanitizeFileName(fileName)}`
}

/** Parse a `storage://bucket/path` reference. Returns null for any other URL. */
export function parseStorageUrl(url: string | null | undefined): { bucket: string; path: string } | null {
  if (!url || !url.startsWith(STORAGE_URL_PREFIX)) return null
  const rest = url.slice(STORAGE_URL_PREFIX.length)
  const slash = rest.indexOf('/')
  if (slash <= 0 || slash === rest.length - 1) return null
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) }
}

export function useFileAttachment() {
  const uploading = ref(false)

  function isDemo(): boolean {
    return useUiStore().isDemoMode
  }

  /** Effective size limit (MB) for the current storage backend. */
  const maxAttachmentMB = computed(() => (isDemo() ? ATTACHMENT_MAX_MB : STORAGE_MAX_MB))

  /**
   * Convert a File to a base64 data URL string.
   */
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  /**
   * Validate an attachment file — returns an error message or null if valid.
   * Defaults to the limit of the active backend (2 MB demo, 20 MB Storage).
   */
  function validateAttachmentFile(file: File, maxSizeMB: number = maxAttachmentMB.value): string | null {
    if (file.size <= 0) {
      return 'File tidak boleh kosong.'
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `Ukuran file maksimal ${maxSizeMB}MB.`
    }
    return null
  }

  /**
   * Store an attachment and return the value to save in `file_url`.
   * Demo mode → base64 data URL. Production → uploads to Supabase Storage
   * and returns a `storage://attachments/<path>` reference.
   * Throws with a user-facing message when the upload fails.
   */
  async function uploadAttachment(file: File, target: UploadTarget): Promise<string> {
    uploading.value = true
    try {
      if (isDemo()) {
        return await fileToBase64(file)
      }

      const auth = useAuthStore()
      const userId = auth.user?.id
      if (!userId) throw new Error('Sesi berakhir. Silakan login ulang.')

      const path = buildStoragePath(target, userId, file.name)
      const supabase = useNuxtApp().$supabase
      const { error } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })

      if (error) throw new Error(`Gagal mengunggah file: ${error.message}`)
      return `${STORAGE_URL_PREFIX}${ATTACHMENT_BUCKET}/${path}`
    } finally {
      uploading.value = false
    }
  }

  /**
   * Resolve a stored `file_url` into something the browser can open.
   * data:/http(s): URLs pass through; storage:// references become signed URLs.
   */
  async function resolveFileUrl(url: string | null | undefined, downloadName?: string): Promise<string | null> {
    if (!url) return null
    const ref = parseStorageUrl(url)
    if (!ref) return url

    const supabase = useNuxtApp().$supabase
    const { data, error } = await supabase.storage
      .from(ref.bucket)
      .createSignedUrl(ref.path, SIGNED_URL_TTL, downloadName ? { download: downloadName } : undefined)

    if (error || !data?.signedUrl) return null
    return data.signedUrl
  }

  /** Remove a previously uploaded storage object (no-op for data:/http URLs). */
  async function removeAttachment(url: string | null | undefined): Promise<void> {
    const ref = parseStorageUrl(url)
    if (!ref) return
    try {
      await useNuxtApp().$supabase.storage.from(ref.bucket).remove([ref.path])
    } catch { /* best effort */ }
  }

  /**
   * Format a byte count into a human-readable string (e.g. "1.2 MB").
   */
  function formatFileSize(bytes: number | null | undefined): string {
    if (!bytes || bytes <= 0) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  /**
   * Trigger a client-side download for a file URL (data:, https: or storage://).
   * Resolves to false when the file cannot be resolved or downloaded.
   */
  async function downloadFile(url: string, filename: string): Promise<boolean> {
    try {
      const href = await resolveFileUrl(url, filename || 'unduhan')
      if (!href) return false

      const a = document.createElement('a')
      a.href = href
      a.download = filename || 'unduhan'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      return true
    } catch {
      return false
    }
  }

  /**
   * Derive a readable filename from a data URL, storage reference or http(s) URL.
   */
  function fileNameFromUrl(url: string | null | undefined, fallback = 'lampiran'): string {
    if (!url) return ''
    const ref = parseStorageUrl(url)
    if (ref) {
      const last = ref.path.split('/').pop() || ''
      // Strip the "{timestamp}-" prefix added by buildStoragePath.
      return last.replace(/^\d+-/, '') || fallback
    }
    try {
      const u = new URL(url)
      // data: URLs carry no meaningful pathname — use the label/fallback.
      if (u.protocol === 'data:') return fallback
      const last = u.pathname.split('/').pop()
      if (last && last.length > 0) {
        return decodeURIComponent(last)
      }
      return fallback
    } catch {
      // Unparseable URL — fall back to a generic name.
      return fallback
    }
  }

  return {
    uploading,
    maxAttachmentMB,
    fileToBase64,
    validateAttachmentFile,
    uploadAttachment,
    resolveFileUrl,
    removeAttachment,
    formatFileSize,
    downloadFile,
    fileNameFromUrl,
  }
}
