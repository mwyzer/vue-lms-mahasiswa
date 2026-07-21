/**
 * Auth Session — DELETE /api/auth/session
 *
 * Clears the session cookie. Called by the auth store on logout.
 */
export default defineEventHandler(
  {
    openAPI: {
      summary: 'Delete Session (Logout)',
      description: 'Menghapus session cookie (lms_session) saat user logout.',
      tags: ['Auth'],
      responses: {
        200: {
          description: 'Session berhasil dihapus',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  ok: { type: 'boolean', example: true },
                },
              },
            },
          },
        },
      },
    },
  },
  async (event) => {
  const cfg = getSessionConfig()
  deleteCookie(event, cfg.name, { path: cfg.path })
  return { ok: true }
})
