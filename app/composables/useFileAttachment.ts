/**
 * useFileAttachment — File attachment helpers for assignments & submissions.
 *
 * Extends useFileUtils with attachment-specific utilities:
 * - read a File into a base64 data URL (demo-mode storage)
 * - validate attachment size with a friendly message
 * - format byte count for display
 * - trigger a client-side download for data URLs and http(s) URLs
 * - derive a display filename from a URL
 */

/** Default maximum attachment size in megabytes. */
export const ATTACHMENT_MAX_MB = 2
export const ATTACHMENT_MAX_BYTES = ATTACHMENT_MAX_MB * 1024 * 1024

export function useFileAttachment() {
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
   */
  function validateAttachmentFile(file: File, maxSizeMB = ATTACHMENT_MAX_MB): string | null {
    if (file.size <= 0) {
      return 'File tidak boleh kosong.'
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `Ukuran file maksimal ${maxSizeMB}MB.`
    }
    return null
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
   * Trigger a client-side download for a file URL (data: or https:).
   * Falls back to opening in a new tab for http(s) URLs in iframe contexts.
   */
  function downloadFile(url: string, filename: string): boolean {
    try {
      const a = document.createElement('a')
      a.href = url
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
   * Derive a readable filename from a data URL or http(s) URL.
   */
  function fileNameFromUrl(url: string | null | undefined, fallback = 'lampiran'): string {
    if (!url) return ''
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
    fileToBase64,
    validateAttachmentFile,
    formatFileSize,
    downloadFile,
    fileNameFromUrl,
  }
}