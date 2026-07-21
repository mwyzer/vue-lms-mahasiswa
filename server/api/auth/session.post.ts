/**
 * Auth Session — POST /api/auth/session
 *
 * Creates a signed session cookie for the authenticated user.
 * Called by the auth store after a successful login.
 *
 * Body: { userId: string, role: 'student' | 'instructor' | 'admin', name: string }
 */
export default defineEventHandler(
  {
    openAPI: {
      summary: 'Create Session',
      description: 'Membuat signed session cookie (lms_session) setelah login berhasil. Cookie berlaku 24 jam.',
      tags: ['Auth'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['userId', 'role', 'name'],
              properties: {
                userId: { type: 'string', description: 'ID pengguna (s1, i1, a1 untuk demo)', example: 's1' },
                role: {
                  type: 'string',
                  enum: ['student', 'instructor', 'admin'],
                  description: 'Role pengguna',
                  example: 'student',
                },
                name: { type: 'string', description: 'Nama lengkap pengguna', example: 'Ahmad Fauzi' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Session berhasil dibuat',
          headers: {
            'Set-Cookie': {
              description: 'Signed session cookie (lms_session)',
              schema: { type: 'string' },
            },
          },
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
        400: { description: 'Data session tidak lengkap (userId, role, atau name kosong)' },
      },
    },
  },
  async (event) => {
  const body = await readBody<{ userId: string; role: 'student' | 'instructor' | 'admin'; name: string }>(event)

  if (!body?.userId || !body?.role || !body?.name) {
    throw createError({ statusCode: 400, statusMessage: 'Data session tidak lengkap.' })
  }

  const sessionCookie = createSessionCookie({
    userId: body.userId,
    role: body.role,
    name: body.name,
  })

  const cfg = getSessionConfig()
  setCookie(event, cfg.name, sessionCookie, {
    path: cfg.path,
    sameSite: cfg.sameSite,
    maxAge: cfg.maxAge,
  })

  return { ok: true }
})
