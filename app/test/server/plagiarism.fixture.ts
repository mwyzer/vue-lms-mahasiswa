/**
 * Indonesian fixture for semantic plagiarism tests (not a test file itself).
 *
 * One question, five answers:
 *   ORIGINAL     — the source answer
 *   COPY         — copy-paste of ORIGINAL with a few small edits
 *   PARAPHRASE   — same ideas and examples as ORIGINAL, rewritten in different words
 *   INDEPENDENT  — an honest answer to the same question (own wording, own examples)
 *   INDEPENDENT2 — another honest answer to the same question
 */
export const QUESTION = 'Jelaskan perbedaan antara stack dan queue beserta contoh penggunaannya.'

export const ORIGINAL =
  'Stack adalah struktur data yang bekerja dengan prinsip LIFO (Last In First Out), artinya elemen yang terakhir dimasukkan akan menjadi elemen pertama yang dikeluarkan. Operasi utamanya adalah push untuk menambah dan pop untuk mengambil elemen dari puncak. Contoh penggunaannya adalah fitur undo pada editor teks dan pemanggilan fungsi rekursif. Queue bekerja dengan prinsip FIFO (First In First Out), sehingga elemen yang pertama masuk akan keluar lebih dulu. Operasinya enqueue dan dequeue. Contohnya antrian printer dan penjadwalan proses pada sistem operasi.'

export const COPY =
  'Stack merupakan struktur data yang bekerja dengan prinsip LIFO (Last In First Out), artinya elemen yang terakhir dimasukkan akan menjadi elemen pertama yang dikeluarkan. Operasi utamanya yaitu push untuk menambah dan pop untuk mengambil elemen dari puncak stack. Contoh penggunaannya adalah fitur undo di editor teks dan pemanggilan fungsi rekursif. Sedangkan queue bekerja dengan prinsip FIFO (First In First Out), sehingga elemen yang pertama masuk akan keluar lebih dulu. Operasinya enqueue dan dequeue. Contohnya antrian printer dan penjadwalan proses pada sistem operasi.'

export const PARAPHRASE =
  'Pada tumpukan, data yang paling akhir ditaruh justru diambil paling awal; konsep ini biasa disebut LIFO. Kita menaruh data ke atas tumpukan lalu mengangkatnya kembali dari bagian teratas. Hal ini dipakai misalnya saat membatalkan perubahan terakhir di aplikasi pengolah kata, juga ketika komputer menyimpan urutan panggilan fungsi yang memanggil dirinya sendiri. Sebaliknya, antrean melayani data sesuai urutan kedatangan, yang datang duluan dilayani duluan (FIFO). Penerapannya terlihat pada daftar tunggu cetak dokumen dan pengaturan giliran program yang dijalankan prosesor.'

export const INDEPENDENT =
  'Perbedaan utama stack dan queue ada pada urutan pengambilan data. Stack mengambil data dari ujung yang sama tempat data dimasukkan, jadi cocok untuk menelusuri riwayat halaman browser saat menekan tombol back atau mengecek keseimbangan tanda kurung pada ekspresi matematika. Queue memasukkan data di belakang dan mengeluarkannya di depan, sehingga cocok untuk sistem tiket layanan pelanggan atau buffer data pada jaringan. Keduanya bisa diimplementasikan dengan array maupun linked list.'

export const INDEPENDENT2 =
  'Stack dan queue sama-sama struktur data linear. Pada stack, penambahan dan penghapusan elemen hanya dilakukan di bagian top, sedangkan pada queue penambahan dilakukan di rear dan penghapusan di front. Dalam pemrograman, stack dipakai untuk evaluasi ekspresi postfix dan algoritma DFS, sedangkan queue dipakai untuk algoritma BFS dan pengelolaan antrian pesan antar layanan. Implementasi queue dengan array perlu memperhatikan circular buffer agar ruang tidak terbuang.'

export const FIXTURE_SUBMISSIONS = [
  { id: 'orig', student_id: 'st1', student_name: 'Ahmad', jawaban: ORIGINAL },
  { id: 'copy', student_id: 'st2', student_name: 'Budi', jawaban: COPY },
  { id: 'para', student_id: 'st3', student_name: 'Citra', jawaban: PARAPHRASE },
  { id: 'ind1', student_id: 'st4', student_name: 'Dian', jawaban: INDEPENDENT },
  { id: 'ind2', student_id: 'st5', student_name: 'Eka', jawaban: INDEPENDENT2 },
]

/** Length of the synthetic "API" vectors (matches EMBEDDING_DIMS). */
const DIMS = 1536

function unitVec(parts: Array<[number, number]>): number[] {
  const v = new Array<number>(DIMS).fill(0)
  for (const [i, w] of parts) v[i] = w
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  return v.map((x) => x / n)
}

/**
 * Hand-built vectors standing in for a real embedding model: axis 0 is the
 * shared topic ("stack vs queue"), axis 1 the specific content of ORIGINAL.
 * COPY and PARAPHRASE share axis 1 (≈ 0.99 / 0.94 cosine with ORIGINAL);
 * independent answers only share the topic (0.64 cosine with everyone).
 * These numbers are a design choice for testing the API-mode logic — they
 * say nothing about how a real model scores these texts.
 */
export const SYNTHETIC_API_VECTORS: Record<string, number[]> = {
  orig: unitVec([[0, 0.8], [1, 0.6]]),
  copy: unitVec([[0, 0.8], [1, 0.58], [2, 0.05]]),
  para: unitVec([[0, 0.8], [1, 0.5], [3, 0.33]]),
  ind1: unitVec([[0, 0.8], [4, 0.6]]),
  ind2: unitVec([[0, 0.8], [5, 0.6]]),
}
