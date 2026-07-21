/**
 * useFileUtils — Generic file utilities composable.
 *
 * Provides helpers for file reading and validation that belong
 * in the business-logic layer, not inline in page components.
 */

export function useFileUtils() {
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
   * Validate an image file — checks type and max size.
   * Returns an error message string or null if valid.
   */
  function validateImageFile(file: File, maxSizeMB = 2): string | null {
    if (!file.type.startsWith('image/')) {
      return 'Hanya file gambar yang diizinkan.'
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `Ukuran foto maksimal ${maxSizeMB}MB.`
    }
    return null
  }

  return {
    fileToBase64,
    validateImageFile,
  }
}
