/**
 * AI Chat API — POST /api/ai/chat
 *
 * AI tutor grounded in lesson content (RAG) with citations.
 *
 * Retrieval (server/utils/rag.ts):
 *   - pgvector: when SUPABASE_SERVICE_ROLE_KEY + Supabase URL are configured and the
 *     client's courses are real (UUID) courses, `match_lesson_chunks` restricted to
 *     the courses the user may read (checked server-side). Falls back to ↓ when it
 *     errors or finds nothing.
 *   - client context (default / demo): lessons sent in `context.lessons`, chunked
 *     and embedded together with the question, ranked by cosine similarity.
 *
 * Answering:
 *   - API key set: model answers from the retrieved material (wrapped as untrusted data).
 *   - Demo / AI unavailable: extractive answer quoted from the best lesson; if nothing
 *     relevant was retrieved, the canned demo knowledge base.
 *
 * Request:  { message: string, context?: { courses?: { nama, kode, deskripsi }[],
 *             lessons?: { id, course_id, course_kode, course_nama, judul, konten }[] } }
 * Response: { reply: string, sources: RagSource[] }
 * Stream (Accept: text/event-stream): `data: {"word": "..."}` events, then one final
 *           `data: {"sources": RagSource[], "done": true}` event.
 * RagSource: { lesson_id, course_id, course_kode, judul, excerpt, score }
 */
import { createClient } from '@supabase/supabase-js'
import { createError, defineEventHandler, getRequestHeader, readBody, setResponseHeader, type H3Event } from 'h3'
import { chatCompletionWith, embedTextsWith, getAiConfig, isAiUnavailable, CHAT_TIMEOUT_MS, type AiConfig } from '../../utils/ai'
import { getUsage, isOverBudget, recordUsage } from '../../utils/costTracker'
import type { SessionData } from '../../utils/session'
import {
  allowedCourseIds,
  buildExtractiveAnswer,
  buildSystemPrompt,
  createUpstreamSseParser,
  dbLookupLessons,
  isUuid,
  resolveServiceConfig,
  retrieveFromContext,
  retrieveFromPgvector,
  rpcMatchChunks,
  sanitizeContextLessons,
  splitForStreaming,
  sseData,
  type LessonMeta,
  type RagLesson,
  type RagSource,
  type RetrievalResult,
} from '../../utils/rag'

const MAX_MESSAGE_CHARS = 2000
const STREAM_TIMEOUT_MS = 60_000
const GREETING_RE = /^(halo|hai|hi|hey|selamat|pagi|siang|sore|malam|hello|test|terima kasih|thanks|makasih|thank you)\b/i

// ── Knowledge base for demo mode ──
const DEMO_KNOWLEDGE: { keywords: string[]; reply: string }[] = [
  {
    keywords: ['pemrograman', 'programming', 'python', 'coding', 'kode'],
    reply:
      'Pemrograman adalah proses menulis instruksi yang dapat dijalankan oleh komputer. Di LMS ini, kamu belajar Pemrograman Dasar menggunakan bahasa Python. Mulai dari pengenalan, variabel, tipe data, percabangan (if-else), hingga perulangan (looping). Tips: praktik langsung adalah kunci utama! Coba tulis kode sendiri setelah membaca materi.',
  },
  {
    keywords: ['variabel', 'tipe data', 'variable', 'data type'],
    reply:
      'Variabel adalah tempat menyimpan data di memori komputer. Python memiliki beberapa tipe data dasar: integer (angka bulat), float (desimal), string (teks), dan boolean (True/False). Contoh: `nama = "Ahmad"` (string), `umur = 20` (integer). Gunakan fungsi `type()` untuk cek tipe data suatu variabel.',
  },
  {
    keywords: ['percabangan', 'if else', 'if-else', 'kondisi', 'condition'],
    reply:
      'Percabangan (if-else) digunakan untuk mengambil keputusan berdasarkan kondisi. Sintaks Python:\n\n```python\nif nilai >= 80:\n    print("Lulus dengan baik")\nelif nilai >= 60:\n    print("Lulus")\nelse:\n    print("Tidak lulus")\n```\n\nPerhatikan indentasi! Python menggunakan indentasi untuk menentukan blok kode.',
  },
  {
    keywords: ['perulangan', 'looping', 'for', 'while', 'loop'],
    reply:
      'Perulangan digunakan untuk menjalankan kode secara berulang. Dua jenis utama:\n\n**For loop** — untuk iterasi range atau koleksi:\n```python\nfor i in range(5):\n    print(f"Perulangan ke-{i}")\n```\n\n**While loop** — selama kondisi terpenuhi:\n```python\ncount = 0\nwhile count < 5:\n    print(count)\n    count += 1\n```',
  },
  {
    keywords: ['matematika', 'matematika diskrit', 'himpunan', 'relasi', 'fungsi', 'discrete'],
    reply:
      'Matematika Diskrit adalah cabang matematika yang mempelajari objek-objek diskrit (terpisah). Topik utama meliputi:\n- **Himpunan**: Kumpulan objek yang terdefinisi dengan jelas\n- **Relasi**: Hubungan antara anggota dua himpunan\n- **Fungsi**: Relasi khusus di mana setiap input memiliki tepat satu output\n\nMatematika diskrit menjadi fondasi penting untuk ilmu komputer, terutama di struktur data dan algoritma.',
  },
  {
    keywords: ['basis data', 'database', 'sql', 'nosql', 'dbms'],
    reply:
      'Basis Data adalah sistem untuk menyimpan dan mengelola data secara terstruktur. Dua jenis utama:\n- **SQL Database**: Data terstruktur dalam tabel (PostgreSQL, MySQL)\n- **NoSQL Database**: Data fleksibel (MongoDB, Firebase)\n\nLMS ini menggunakan **PostgreSQL** (Supabase) sebagai database utama. Konsep kunci: tabel, primary key, foreign key, indexing, query dengan SELECT, INSERT, UPDATE, DELETE.',
  },
  {
    keywords: ['struktur data', 'array', 'linked list', 'tree', 'stack', 'queue'],
    reply:
      'Struktur Data adalah cara menyusun dan menyimpan data agar dapat diakses dan dimodifikasi secara efisien. Beberapa fundamental:\n- **Array**: Koleksi elemen dengan index\n- **Linked List**: Rantai node yang saling terhubung\n- **Stack**: LIFO (Last In, First Out)\n- **Queue**: FIFO (First In, First Out)\n- **Tree**: Struktur hierarkis dengan root dan cabang\n\nPemilihan struktur data yang tepat sangat mempengaruhi performa program.',
  },
  {
    keywords: ['oop', 'objek', 'object', 'class', 'inheritance', 'polymorphism', 'enkapsulasi', 'encapsulation'],
    reply:
      'Pemrograman Berorientasi Objek (OOP) adalah paradigma yang mengorganisir kode dalam "objek" yang memiliki data (atribut) dan behavior (method).\n\n**4 pilar OOP:**\n1. **Encapsulation** — Menyembunyikan detail internal\n2. **Inheritance** — Mewariskan sifat dari class induk\n3. **Polymorphism** — Banyak bentuk dari satu method\n4. **Abstraction** — Menyembunyikan kompleksitas\n\nContoh: class `Mahasiswa` dengan atribut `nama`, `npm`, dan method `belajar()`.',
  },
  {
    keywords: ['jaringan', 'komputer', 'tcp/ip', 'routing', 'network', 'ip address'],
    reply:
      'Jaringan Komputer adalah sistem yang menghubungkan dua atau lebih komputer untuk berbagi data. Konsep penting:\n- **TCP/IP**: Protokol utama internet\n- **IP Address**: Alamat unik setiap perangkat\n- **DNS**: Menerjemahkan domain ke IP\n- **Routing**: Menentukan jalur pengiriman data\n- **Firewall**: Keamanan jaringan\n\nModel OSI memiliki 7 layer, sedangkan TCP/IP memiliki 4 layer.',
  },
  {
    keywords: ['kecerdasan buatan', 'ai', 'artificial intelligence', 'machine learning', 'deep learning', 'ml'],
    reply:
      'Kecerdasan Buatan (AI) adalah bidang yang membuat mesin dapat berpikir dan belajar seperti manusia.\n\n**Cabang utama:**\n- **Machine Learning**: Mesin belajar dari data\n- **Deep Learning**: Neural network dengan banyak layer\n- **NLP**: Memproses bahasa manusia\n- **Computer Vision**: Memproses gambar\n\nContoh penerapan: chatbot, rekomendasi produk, pengenalan wajah, dan tentu saja saya, asisten AI LMS ini! 😊',
  },
  {
    keywords: ['keamanan', 'informasi', 'kriptografi', 'cryptography', 'hacking', 'security'],
    reply:
      'Keamanan Informasi adalah praktik melindungi data dari akses yang tidak sah. Pilar utamanya: **CIA Triad** — Confidentiality (kerahasiaan), Integrity (integritas), Availability (ketersediaan).\n\n**Topik kunci:**\n- **Kriptografi**: Enkripsi dan dekripsi data\n- **Ethical Hacking**: Menguji keamanan sistem secara legal\n- **Security Audit**: Memeriksa celah keamanan\n- **Firewall & IDS**: Melindungi jaringan dari serangan',
  },
  {
    keywords: ['rekayasa perangkat lunak', 'rpl', 'software engineering', 'sdlc', 'agile', 'scrum', 'uml'],
    reply:
      'Rekayasa Perangkat Lunak (RPL/SWE) adalah pendekatan sistematis untuk mengembangkan perangkat lunak.\n\n**Model SDLC:**\n- **Waterfall**: Bertahap dan berurutan\n- **Agile**: Iteratif dan adaptif (populer!)\n- **Scrum**: Framework Agile dengan sprint\n\n**Tahapan SDLC**: Analisis → Desain → Implementasi → Testing → Deployment → Maintenance.\n\nLMS ini dibangun dengan pendekatan Agile — fitur dikembangkan bertahap per fase!',
  },
  {
    keywords: ['tugas', 'assignment', 'deadline', 'tenggat', 'kumpul', 'submission'],
    reply:
      'Tips mengelola tugas di LMS:\n1. **Cek deadline** secara rutin di halaman Tugas\n2. **Jangan menunda** — kumpulkan segera setelah selesai\n3. **Perbarui submission** jika ada revisi sebelum deadline\n4. **Cek feedback** dari instruktur setelah dinilai\n5. **Manajemen waktu** — kerjakan tugas yang deadline-nya lebih dulu\n\nKalau ada kendala teknis, hubungi instruktur atau admin.',
  },
  {
    keywords: ['progress', 'materi', 'belajar', 'study', 'lesson', 'course'],
    reply:
      'Untuk memaksimalkan pembelajaran di LMS:\n1. Ikuti materi secara **berurutan** — setiap lesson dibangun di atas lesson sebelumnya\n2. Tandai materi **selesai** setelah benar-benar paham\n3. Pantau **progress bar** di setiap mata kuliah\n4. Manfaatkan **fitur prev/next** untuk navigasi materi\n5. **Diskusikan** dengan teman jika ada yang kurang paham\n\nProgres belajar kamu tersimpan otomatis!',
  },
  {
    keywords: ['login', 'masuk', 'auth', 'autentikasi', 'password'],
    reply:
      'Login ke LMS:\n- **Mahasiswa**: Pilih role Mahasiswa → Pilih Level (1-4) → Pilih sesi (Pagi/Malam) → Klik nama kamu\n- **Instruktur**: Pilih role Instruktur → Pilih nama → Masukkan password\n- **Admin**: Pilih role Admin → Masukkan password\n\nData login default ada di README.md. Hubungi admin jika ada masalah login.',
  },
]

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const startsWord = (text: string, kw: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(kw)}`, 'u').test(text)

// ── Demo mode response ──
function getDemoReply(message: string): { reply: string } {
  const lower = message.toLowerCase()

  // Check for greetings
  if (/^(halo|hai|hi|hey|selamat|pagi|siang|sore|malam|hello|test)/i.test(lower)) {
    return {
      reply:
        'Halo! 👋 Saya asisten AI LMS Mahasiswa. Saya bisa membantu menjelaskan materi perkuliahan, memberikan tips belajar, atau menjawab pertanyaan seputar LMS. Ada yang bisa saya bantu?',
    }
  }

  // Check for thanks
  if (/^(terima kasih|thanks|makasih|thank you)/i.test(lower)) {
    return {
      reply: 'Sama-sama! 😊 Senang bisa membantu. Kalau ada pertanyaan lain, jangan ragu untuk bertanya ya!',
    }
  }

  // Check for course info
  const courseMatch = lower.match(/(mk\d{3}|course|mata kuliah)\s*(\d*)/i)
  if (courseMatch) {
    return {
      reply:
        'Untuk informasi detail mata kuliah, buka halaman **Mata Kuliah** di sidebar. Di sana kamu bisa melihat daftar lengkap mata kuliah yang kamu ikuti beserta progres pembelajaran. Setiap mata kuliah memiliki materi, tugas, dan instruktur pengampu.',
    }
  }

  // Find best matching knowledge
  let bestMatch: { reply: string } | null = null
  let bestScore = 0

  for (const item of DEMO_KNOWLEDGE) {
    // Keywords must start a word ("ai" must not match "bagaimana").
    const score = item.keywords.filter((kw) => startsWord(lower, kw.toLowerCase())).length
    if (score > bestScore) {
      bestScore = score
      bestMatch = item
    }
  }

  if (bestMatch && bestScore > 0) {
    return { reply: bestMatch.reply }
  }

  // Default fallback
  return {
    reply:
      'Maaf, saya belum memiliki informasi tentang itu. 😅 Saya masih dalam tahap pengembangan dan pengetahuan saya terbatas pada materi yang ada di LMS. Coba tanyakan tentang:\n\n' +
      '• Materi perkuliahan (Pemrograman Dasar, Matematika Diskrit, Struktur Data, dll.)\n' +
      '• Tips belajar dan mengerjakan tugas\n' +
      '• Cara menggunakan fitur LMS\n' +
      '• Konsep pemrograman (variabel, looping, OOP, dll.)',
  }
}


const ragSourceSchema = {
  type: 'object',
  properties: {
    lesson_id: { type: 'string' },
    course_id: { type: 'string' },
    course_kode: { type: 'string', example: 'MK101' },
    judul: { type: 'string', example: 'Variabel dan Tipe Data' },
    excerpt: { type: 'string', description: 'Potongan materi yang dipakai' },
    score: { type: 'number', description: 'Skor kemiripan (0–1)', example: 0.42 },
  },
}

defineRouteMeta({
  openAPI: {
    summary: 'AI Chat (tutor berbasis materi)',
    description:
      'Mengirim pertanyaan ke AI tutor. Jawaban didasarkan pada isi materi (lessons.konten) dari mata kuliah pengguna ' +
      'dan disertai daftar sumber (materi yang dipakai).\n\n' +
      '**Retrieval**: pgvector (`match_lesson_chunks`) bila service role key dikonfigurasi, selain itu dari `context.lessons` yang dikirim klien.\n' +
      '**Mode Demo** (tanpa NUXT_AI_API_KEY): jawaban ekstraktif dari materi; bila tidak ada materi relevan, knowledge-base lokal.\n' +
      '**Streaming**: kirim header `Accept: text/event-stream`. Event `data: {"word": "..."}` lalu satu event akhir `data: {"sources": [...], "done": true}`.',
    tags: ['AI'],
    security: [{ cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['message'],
            properties: {
              message: {
                type: 'string',
                maxLength: 2000,
                description: 'Pesan pertanyaan untuk AI assistant',
                example: 'Jelaskan apa itu variabel dalam Python?',
              },
              context: {
                type: 'object',
                properties: {
                  courses: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        nama: { type: 'string', description: 'Nama mata kuliah' },
                        kode: { type: 'string', description: 'Kode mata kuliah' },
                        deskripsi: { type: 'string', description: 'Deskripsi mata kuliah' },
                      },
                    },
                    description: 'Daftar mata kuliah mahasiswa untuk konteks AI',
                  },
                  lessons: {
                    type: 'array',
                    maxItems: 100,
                    description: 'Materi dari mata kuliah pengguna (kandidat retrieval). Maks 100 materi, 20.000 karakter per materi, 150.000 total.',
                    items: {
                      type: 'object',
                      required: ['id', 'course_id', 'konten'],
                      properties: {
                        id: { type: 'string' },
                        course_id: { type: 'string' },
                        course_kode: { type: 'string' },
                        course_nama: { type: 'string' },
                        judul: { type: 'string' },
                        konten: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Balasan AI berhasil',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                reply: { type: 'string', description: 'Balasan dari AI assistant', example: 'Variabel adalah tempat menyimpan data...' },
                sources: { type: 'array', items: ragSourceSchema, description: 'Materi sumber jawaban (maks 3, satu per materi)' },
              },
            },
          },
          'text/event-stream': {
            schema: {
              type: 'string',
              description: 'SSE stream — chunk `data: {"word": "..."}\\n\\n`, diakhiri `data: {"sources": [...], "done": true}\\n\\n`',
            },
          },
        },
      },
      400: { description: 'Pesan kosong/terlalu panjang (>2000 karakter) atau konteks materi terlalu besar' },
      401: { description: 'Unauthorized — session cookie tidak valid' },
      429: { description: 'Rate limit / batas harian token AI tercapai' },
    },
  },
})

// ── Retrieval ──

function serviceClient(event: H3Event) {
  const config = useRuntimeConfig(event) as unknown as { supabaseServiceRoleKey?: string; public?: { supabaseUrl?: string } }
  const svc = resolveServiceConfig({
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || config.supabaseServiceRoleKey,
    url: config.public?.supabaseUrl,
  })
  if (!svc) return null
  return createClient(svc.url, svc.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

const isHttp429 = (err: unknown) => (err as { statusCode?: number } | null)?.statusCode === 429

async function retrieve(
  event: H3Event,
  config: AiConfig,
  session: SessionData | undefined,
  message: string,
  lessons: RagLesson[],
): Promise<RetrievalResult> {
  const embed = (texts: string[]) => embedTextsWith(config, texts)
  const expectedMode = config.isDemo ? ('local' as const) : ('api' as const)

  // Backend 2 — pgvector (only for real UUID courses and a configured service role).
  const courseIds = [...new Set(lessons.map((l) => l.course_id))].filter(isUuid)
  if (session && courseIds.length > 0) {
    const db = serviceClient(event)
    if (db) {
      try {
        const allowed = await allowedCourseIds(db, session, courseIds)
        if (allowed.length > 0) {
          const known: Record<string, LessonMeta> = {}
          for (const l of lessons) known[l.id] = { judul: l.judul, course_id: l.course_id, course_kode: l.course_kode }
          const res = await retrieveFromPgvector(message, {
            embed,
            matchChunks: rpcMatchChunks(db),
            lookupLessons: dbLookupLessons(db),
            knownLessons: known,
            courseIds: allowed,
          })
          if (res.sources.length > 0) return res
        }
      } catch (err) {
        if (isHttp429(err)) throw err
        console.warn('[RAG] pgvector retrieval failed, using client context:', (err as Error)?.message ?? err)
      }
    }
  }

  // Backend 1 — lessons sent by the client.
  return retrieveFromContext(message, lessons, { embed, expectedMode, namespace: config.embeddingModel })
}

// ── Streaming helpers ──

function startStream(event: H3Event) {
  setResponseHeader(event, 'content-type', 'text/event-stream')
  setResponseHeader(event, 'cache-control', 'no-cache')
  setResponseHeader(event, 'connection', 'keep-alive')
  // Disable proxy buffering so chunks reach the client as they are written.
  setResponseHeader(event, 'x-accel-buffering', 'no')
}

const isClosed = (event: H3Event) => event.node.res.writableEnded || event.node.res.destroyed

function write(event: H3Event, chunk: string) {
  if (!isClosed(event)) event.node.res.write(chunk)
}

/** Stream a finished reply word by word (demo / fallback), then the sources event. */
async function streamReply(event: H3Event, reply: string, sources: RagSource[], delayMs = 30) {
  startStream(event)
  for (const word of splitForStreaming(reply)) {
    if (isClosed(event)) break
    write(event, sseData({ word }))
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
  }
  write(event, sseData({ sources, done: true }))
  if (!isClosed(event)) event.node.res.end()
}

/** Answer without the LLM: extractive from retrieved material, else the canned knowledge base. */
function fallbackAnswer(message: string, retrieval: RetrievalResult): { reply: string; sources: RagSource[] } {
  const extractive = buildExtractiveAnswer(message, retrieval.chunks)
  if (extractive) return { reply: extractive, sources: retrieval.sources }
  return { reply: getDemoReply(message).reply, sources: [] }
}

function budgetExceeded() {
  const usage = getUsage()
  console.warn(`[CostTracker] Daily budget exceeded: ${usage.totalTokens} tokens used`)
  return createError({ statusCode: 429, statusMessage: 'Batas harian penggunaan AI telah tercapai. Coba lagi besok.' })
}

/**
 * Relay an OpenAI-compatible streaming completion as `{ word }` events.
 * Returns false (nothing written yet) when the upstream call fails before streaming,
 * so the caller can fall back.
 */
async function relayModelStream(event: H3Event, config: AiConfig, system: string, message: string, sources: RagSource[]): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS)
  const onClose = () => controller.abort()
  event.node.res.on('close', onClose)

  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: message },
        ],
        temperature: 0.4,
        max_tokens: 1024,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    event.node.res.off('close', onClose)
    console.warn('[AI Chat] stream request failed:', (err as Error)?.message ?? err)
    return false
  }
  if (!response.ok || !response.body) {
    clearTimeout(timer)
    event.node.res.off('close', onClose)
    const text = await response.text().catch(() => '')
    console.warn(`[AI Chat] AI API error ${response.status}: ${text.slice(0, 300)}`)
    return false
  }

  startStream(event)
  const parser = createUpstreamSseParser()
  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let reply = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const word of parser.push(decoder.decode(value, { stream: true }))) {
        reply += word
        write(event, sseData({ word }))
      }
    }
    for (const word of parser.end()) {
      reply += word
      write(event, sseData({ word }))
    }
  } catch (err) {
    if (!isClosed(event)) console.warn('[AI Chat] stream interrupted:', (err as Error)?.message ?? err)
  } finally {
    clearTimeout(timer)
    event.node.res.off('close', onClose)
  }

  if (!reply.trim() && !isClosed(event)) {
    write(event, sseData({ word: 'Maaf, saya tidak bisa memberikan jawaban saat ini.' }))
  }
  // Cost tracking — real usage when the API sent it (stream_options.include_usage), else estimate.
  const usage = parser.usage
  const promptTokens = Number(usage?.prompt_tokens ?? Math.ceil((system.length + message.length) / 4))
  const completionTokens = Number(usage?.completion_tokens ?? Math.ceil(reply.length / 4))
  recordUsage(promptTokens, completionTokens)

  write(event, sseData({ sources, done: true }))
  if (!isClosed(event)) event.node.res.end()
  return true
}

// ── Handler ──

export default defineEventHandler(async (event) => {
  const body = await readBody<{ message?: unknown; context?: Record<string, unknown> }>(event)
  const message = typeof body?.message === 'string' ? body.message.trim() : ''

  if (!message) {
    throw createError({ statusCode: 400, statusMessage: 'Message is required' })
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    throw createError({ statusCode: 400, statusMessage: `Pesan terlalu panjang. Maksimal ${MAX_MESSAGE_CHARS} karakter.` })
  }

  const context = body?.context && typeof body.context === 'object' ? body.context : {}
  const { lessons } = sanitizeContextLessons(context.lessons)
  const courses = Array.isArray(context.courses) ? (context.courses as Array<Record<string, string>>) : []

  const config = getAiConfig(event)
  const session = event.context.session as SessionData | undefined
  const wantsStream = (getRequestHeader(event, 'accept') || '').includes('text/event-stream')

  // Greetings/thanks need no retrieval.
  const isSmallTalk = message.length <= 40 && GREETING_RE.test(message)
  const retrieval: RetrievalResult = isSmallTalk
    ? { chunks: [], sources: [], mode: null, backend: 'none' }
    : await retrieve(event, config, session, message, lessons)

  // ── DEMO MODE (no API key): extractive / canned ──
  if (config.isDemo) {
    const { reply, sources } = fallbackAnswer(message, retrieval)
    if (wantsStream) {
      await streamReply(event, reply, sources)
      return
    }
    await new Promise((r) => setTimeout(r, 300))
    return { reply, sources }
  }

  // ── REAL AI MODE ──
  const system = buildSystemPrompt({ chunks: retrieval.chunks, courses })
  const sources = retrieval.sources

  if (wantsStream) {
    if (isOverBudget()) throw budgetExceeded()
    const streamed = await relayModelStream(event, config, system, message, sources)
    if (!streamed) {
      const fb = fallbackAnswer(message, retrieval)
      await streamReply(event, fb.reply, fb.sources, 0)
    }
    return
  }

  try {
    const { content, promptTokens, completionTokens } = await chatCompletionWith(config, {
      system,
      user: message,
      temperature: 0.4,
      maxTokens: 1024,
      timeoutMs: CHAT_TIMEOUT_MS,
    })
    console.log(`[CostTracker] chat: ${promptTokens}+${completionTokens} tokens, ${getUsage().totalTokens} total today`)
    return { reply: content, sources }
  } catch (err) {
    if (!isAiUnavailable(err)) throw err
    console.warn(`[AI Chat] AI unavailable (${err.reason}), using fallback: ${err.message}`)
    return fallbackAnswer(message, retrieval)
  }
})
