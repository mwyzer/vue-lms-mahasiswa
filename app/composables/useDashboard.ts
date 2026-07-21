/**
 * useDashboard — Shared dashboard utilities composable.
 *
 * Provides greeting, date formatting, deadline checking, and
 * event-type helpers used across dashboard pages. Also exports
 * the bento-grid IntersectionObserver reveal logic.
 */

export function useDashboard() {
  /**
   * Indonesian time-based greeting.
   */
  function greeting(): string {
    const hour = new Date().getHours()
    if (hour < 10) return 'Selamat Pagi'
    if (hour < 15) return 'Selamat Siang'
    if (hour < 18) return 'Selamat Sore'
    return 'Selamat Malam'
  }

  /**
   * Format a date string to Indonesian locale.
   */
  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /**
   * Check if a deadline is within 24 hours.
   */
  function isCloseToDeadline(dateStr: string): boolean {
    const diff = new Date(dateStr).getTime() - new Date().getTime()
    return diff > 0 && diff < 24 * 60 * 60 * 1000
  }

  /**
   * Map event type to a CSS accent class.
   */
  function eventTypeClass(tipe?: string): string {
    const map: Record<string, string> = {
      uts: 'dot--danger',
      uas: 'dot--warning',
      tugas: 'dot--primary',
      libur: 'dot--accent',
    }
    return map[tipe || ''] || 'dot--info'
  }

  /**
   * Bento-grid staggered reveal via IntersectionObserver.
   * Call once in onMounted. Respects reduced-motion.
   */
  function initRevealAnimations() {
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-inview')
              observer.unobserve(entry.target)
            }
          })
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
      )

      nextTick(() => {
        document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
      })
    } else {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-inview'))
    }
  }

  return {
    greeting,
    formatDate,
    isCloseToDeadline,
    eventTypeClass,
    initRevealAnimations,
  }
}
