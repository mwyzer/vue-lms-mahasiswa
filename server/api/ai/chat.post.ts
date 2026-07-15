/**
 * AI Chat API — POST /api/ai/chat
 *
 * Accepts a user message and optional course context, returns an AI-generated reply.
 * Supports two modes:
 *   1. Real AI: Uses OpenAI-compatible API when NUXT_AI_API_KEY is set
 *   2. Demo mode: Returns context-aware mock responses based on lesson content
 *
 * Request:  { message: string, context?: { courses?: { nama, kode, deskripsi }[] } }
 * Response: { reply: string, sources?: string[] }
 */
import type { Lesson } from '~/types/database'

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

// ── Demo mode response ──
function getDemoReply(message: string): { reply: string; sources?: string[] } {
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
    const score = item.keywords.filter((kw) => lower.includes(kw.toLowerCase())).length
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

// ── EventStream: write a SSE chunk ──
function writeChunk(res: { write: (chunk: string) => void }, word: string) {
  res.write(`data: ${JSON.stringify({ word })}\n\n`)
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ message: string; context?: Record<string, unknown> }>(event)
  const message = body?.message?.trim()

  if (!message) {
    throw createError({ statusCode: 400, statusMessage: 'Message is required' })
  }

  const config = useRuntimeConfig(event)
  const aiApiKey = config.aiApiKey as string | undefined
  const aiModel = (config.aiModel as string) || 'gpt-4o-mini'
  const isDemo = !aiApiKey

  // ── Build context for the AI ──
  const courseContext = body?.context?.courses
  let systemPrompt =
    'Kamu adalah asisten AI untuk LMS Mahasiswa, sebuah Learning Management System untuk mahasiswa Indonesia. ' +
    'Kamu membantu mahasiswa memahami materi perkuliahan, mengerjakan tugas, dan menggunakan fitur LMS. ' +
    'Gunakan bahasa Indonesia yang ramah dan mudah dipahami. ' +
    'Jawab dengan jelas, berikan contoh jika memungkinkan. ' +
    'Jika ditanya di luar konteks LMS, arahkan kembali ke materi perkuliahan.'

  if (courseContext && Array.isArray(courseContext) && courseContext.length > 0) {
    const courseList = courseContext
      .map((c: any) => `- ${c.kode}: ${c.nama} — ${c.deskripsi || ''}`)
      .join('\n')
    systemPrompt += `\n\nMahasiswa ini sedang mengambil mata kuliah berikut:\n${courseList}`
  }

  // ── Check if client wants streaming ──
  const acceptHeader = getRequestHeader(event, 'accept') || ''
  const wantsStream = acceptHeader.includes('text/event-stream')

  if (isDemo) {
    // ── DEMO MODE ──
    const { reply } = getDemoReply(message)

    if (wantsStream) {
      setResponseHeader(event, 'content-type', 'text/event-stream')
      setResponseHeader(event, 'cache-control', 'no-cache')
      setResponseHeader(event, 'connection', 'keep-alive')

      const words = reply.split(/(?<=\s)/)
      for (const word of words) {
        writeChunk(event.node.res, word)
        await new Promise((r) => setTimeout(r, 30))
      }
      event.node.res.end()
      return
    }

    // Simulate network delay for non-streaming
    await new Promise((r) => setTimeout(r, 500))
    return { reply, sources: [] }
  }

  // ── REAL AI MODE (OpenAI-compatible) ──
  // Check daily budget before calling API
  if (isOverBudget()) {
    const usage = getUsage()
    console.warn(`[CostTracker] Daily budget exceeded: ${usage.totalTokens} tokens used`)
    throw createError({
      statusCode: 429,
      statusMessage: 'Batas harian penggunaan AI telah tercapai. Coba lagi besok.',
    })
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiApiKey}`,
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 1024,
        stream: wantsStream,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`AI API error: ${response.status} ${errText}`)
    }

    if (wantsStream) {
      // Stream response back to client
      setResponseHeader(event, 'content-type', 'text/event-stream')
      setResponseHeader(event, 'cache-control', 'no-cache')
      setResponseHeader(event, 'connection', 'keep-alive')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          // Parse OpenAI SSE format and forward words
          const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))
          for (const line of lines) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || ''
              if (content) {
                writeChunk(event.node.res, content)
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      }
      event.node.res.end()

      // Cost tracking for streaming (estimate)
      const estimatedCompletion = Math.ceil((systemPrompt.length + message.length) / 4)
      recordUsage(estimatedCompletion, 0)
      return
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content || 'Maaf, saya tidak bisa memberikan jawaban saat ini.'

    // Cost tracking — use OpenAI response usage if available, else estimate
    const promptTokens = data.usage?.prompt_tokens ?? Math.ceil((systemPrompt.length + message.length) / 4)
    const completionTokens = data.usage?.completion_tokens ?? Math.ceil(reply.length / 4)
    const usage = recordUsage(promptTokens, completionTokens)
    console.log(`[CostTracker] Request #${usage.requestCount}: ${usage.totalTokens} total tokens today`)

    return { reply, sources: [] }
  } catch (error: any) {
    console.error('AI Chat error:', error)
    // Fallback to demo mode on error
    const { reply } = getDemoReply(message)
    return { reply, sources: [] }
  }
})
