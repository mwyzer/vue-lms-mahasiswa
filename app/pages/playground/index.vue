<script setup lang="ts">
/**
 * Python Playground — Interactive Python code editor in the browser.
 * Uses Pyodide (WebAssembly) to run Python code client-side.
 */
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth'],
})

const { state: pyodide, stdout, stderr, init, runCode } = usePyodide()

// ── Code editor state ──
const code = ref([
  '# Selamat datang di Python Playground! 🐍',
  '# Tulis kode Python di sini dan klik Run.',
  '',
  'print("Hello, LMS Mahasiswa!")',
  '',
  '# Contoh: variabel dan perulangan',
  'nama = "Python"',
  'for i in range(5):',
  '    print(f"{nama} ke-{i+1}")',
].join('\n'))

const isRunning = ref(false)
const runError = ref<string | null>(null)
const outputLines = ref<{ type: 'stdout' | 'stderr'; text: string }[]>([])
const activeTab = ref<'editor' | 'output'>('editor')

// ── Example snippets ──
const examples = [
  {
    label: 'Hello World',
    code: [
      'print("Hello, LMS Mahasiswa! 🐍")',
      'print("Selamat belajar Python!")',
    ].join('\n'),
  },
  {
    label: 'Variabel & Tipe Data',
    code: [
      '# Variabel dan tipe data',
      'nama = "Budi"',
      'umur = 20',
      'tinggi = 175.5',
      'menikah = False',
      '',
      'print(f"Nama: {nama}  ({type(nama).__name__})")',
      'print(f"Umur: {umur}  ({type(umur).__name__})")',
      'print(f"Tinggi: {tinggi}  ({type(tinggi).__name__})")',
      'print(f"Menikah: {menikah}  ({type(menikah).__name__})")',
    ].join('\n'),
  },
  {
    label: 'Perulangan',
    code: [
      '# Perulangan for',
      'print("=== Perulangan For ===")',
      'for i in range(1, 6):',
      '    print(f"Perulangan ke-{i}")',
      '',
      'print()',
      '',
      '# Perulangan while',
      'print("=== Perulangan While ===")',
      'count = 0',
      'while count < 5:',
      '    print(f"Count: {count}")',
      '    count += 1',
    ].join('\n'),
  },
  {
    label: 'Percabangan',
    code: [
      '# Percabangan if-elif-else',
      'nilai = 85',
      '',
      'if nilai >= 90:',
      '    grade = "A"',
      'elif nilai >= 80:',
      '    grade = "B"',
      'elif nilai >= 70:',
      '    grade = "C"',
      'elif nilai >= 60:',
      '    grade = "D"',
      'else:',
      '    grade = "E"',
      '',
      'print(f"Nilai: {nilai}")',
      'print(f"Grade: {grade}")',
    ].join('\n'),
  },
  {
    label: 'List & Fungsi',
    code: [
      '# List dan fungsi sederhana',
      'def hitung_rata_rata(daftar):',
      '    """Menghitung rata-rata dari sebuah list."""',
      '    return sum(daftar) / len(daftar)',
      '',
      '# Data nilai mahasiswa',
      'nilai = [85, 92, 78, 90, 88]',
      'print(f"Nilai: {nilai}")',
      'print(f"Tertinggi: {max(nilai)}")',
      'print(f"Terendah: {min(nilai)}")',
      'print(f"Rata-rata: {hitung_rata_rata(nilai):.2f}")',
      '',
      '# Filter nilai di atas 85',
      'lulus = [n for n in nilai if n >= 85]',
      'print(f"Nilai >= 85: {lulus}")',
    ].join('\n'),
  },
  {
    label: 'Matematika',
    code: [
      '# Operasi matematika dasar',
      'import math',
      '',
      'angka = 16',
      'print(f"Akar kuadrat dari {angka} = {math.sqrt(angka)}")',
      'print(f"Pi = {math.pi:.4f}")',
      'print(f"Sin(90 deg) = {math.sin(math.radians(90)):.2f}")',
      '',
      '# Faktorial',
      'for i in range(1, 8):',
      '    print(f"{i}! = {math.factorial(i)}")',
    ].join('\n'),
  },
]

function loadExample(example: typeof examples[0]) {
  code.value = example.code
  outputLines.value = []
  runError.value = null
  activeTab.value = 'editor'
}

// ── Run code ──
async function handleRun() {
  if (!code.value.trim()) return

  isRunning.value = true
  runError.value = null
  outputLines.value = []
  activeTab.value = 'output'

  try {
    const { output, error } = await runCode(code.value)

    if (output) {
      // Split output into lines for display
      const lines = output.split('\n')
      for (const line of lines) {
        if (line) outputLines.value.push({ type: 'stdout', text: line })
      }
    }

    if (error) {
      const lines = error.split('\n')
      for (const line of lines) {
        if (line) outputLines.value.push({ type: 'stderr', text: line })
      }
      runError.value = error
    }
  } catch (e: any) {
    runError.value = e.message || 'Terjadi kesalahan'
    outputLines.value.push({ type: 'stderr', text: runError.value })
  } finally {
    isRunning.value = false
  }
}

function handleClear() {
  outputLines.value = []
  runError.value = null
}

function handleKeydown(e: KeyboardEvent) {
  // Run on Ctrl+Enter / Cmd+Enter
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    handleRun()
  }
}
</script>

<template>
  <div class="playground-page">
    <CommonPageHeader title="Python Playground 🐍" subtitle="Tulis dan jalankan kode Python langsung di browser — tanpa instalasi!" />

    <!-- Example snippets -->
    <section class="examples-bar">
      <span class="examples-label">Contoh:</span>
      <button
        v-for="ex in examples"
        :key="ex.label"
        class="btn btn-sm example-chip"
        @click="loadExample(ex)"
      >
        {{ ex.label }}
      </button>
    </section>

    <!-- Mobile: tab toggles -->
    <div class="mobile-tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'editor' }"
        @click="activeTab = 'editor'"
      >
        ✏️ Editor
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'output' }"
        @click="activeTab = 'output'"
      >
        📋 Output
        <span v-if="outputLines.length" class="output-badge">{{ outputLines.length }}</span>
      </button>
    </div>

    <!-- Main playground area -->
    <div class="playground-layout">
      <!-- Editor panel -->
      <div class="editor-panel" :class="{ 'mobile-hidden': activeTab !== 'editor' }">
        <div class="editor-header">
          <div class="editor-dots">
            <span class="dot dot-red" />
            <span class="dot dot-yellow" />
            <span class="dot dot-green" />
          </div>
          <span class="editor-filename">main.py</span>
          <div class="editor-actions">
            <button
              class="btn btn-sm btn-ghost clear-btn"
              :disabled="!code && outputLines.length === 0"
              @click="handleClear"
            >
              🗑️ Hapus
            </button>
            <button
              class="btn btn-sm btn-primary run-btn"
              :disabled="isRunning || !code.trim()"
              @click="handleRun"
            >
              <span v-if="isRunning" class="spinner" />
              <span v-else>▶</span>
              {{ isRunning ? 'Menjalankan...' : 'Run' }}
            </button>
          </div>
        </div>

        <textarea
          v-model="code"
          class="code-editor"
          spellcheck="false"
          wrap="off"
          placeholder="Tulis kode Python di sini..."
          @keydown="handleKeydown"
        />
      </div>

      <!-- Output panel -->
      <div class="output-panel" :class="{ 'mobile-hidden': activeTab !== 'output' }">
        <div class="output-header">
          <span class="output-title">📋 Output</span>
          <div class="output-info">
            <span v-if="isRunning" class="output-status running">Memproses...</span>
            <button
              v-if="outputLines.length > 0"
              class="btn btn-ghost btn-sm"
              @click="handleClear"
            >
              ✕ Bersihkan
            </button>
          </div>
        </div>

        <div class="output-content">
          <!-- Loading state -->
          <div v-if="isRunning" class="output-loading">
            <div class="spinner-lg" />
            <p>Menjalankan kode...</p>
          </div>

          <!-- Pyodide not ready -->
          <div v-else-if="pyodide.loading" class="output-loading">
            <div class="spinner-lg" />
            <p>Memuat Python runtime...</p>
            <span class="text-xs text-muted">Mengunduh Pyodide (WebAssembly)</span>
          </div>

          <!-- Error loading Pyodide -->
          <div v-else-if="pyodide.error" class="output-empty error">
            <p>⚠️ {{ pyodide.error }}</p>
          </div>

          <!-- Output lines -->
          <div v-else-if="outputLines.length > 0" class="output-lines">
            <div
              v-for="(line, i) in outputLines"
              :key="i"
              class="output-line"
              :class="line.type"
            >
              <span class="line-number">{{ i + 1 }}</span>
              <pre class="line-text">{{ line.text }}</pre>
            </div>
          </div>

          <!-- Empty state -->
          <div v-else class="output-empty">
            <p>Klik <strong>Run</strong> untuk menjalankan kode.</p>
            <p class="text-xs text-muted" style="margin-top: 0.25rem;">Gunakan Ctrl+Enter untuk shortcut</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.playground-page {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--header-height, 64px) - 3rem);
}

/* ── Examples bar ── */
.examples-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.examples-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-neutral-500);
  white-space: nowrap;
}

.example-chip {
  background-color: var(--color-primary-50);
  color: var(--color-primary-700);
  border: 1px solid var(--color-primary-200);
  border-radius: 999px;
  font-size: 0.6875rem;
  padding: 0.25rem 0.75rem;
  transition: all 0.15s ease;
}

.example-chip:hover {
  background-color: var(--color-primary-100);
  border-color: var(--color-primary-400);
}

/* ── Mobile tabs ── */
.mobile-tabs {
  display: none;
  gap: 0;
  margin-bottom: 1rem;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-neutral-200);
}

.tab-btn {
  flex: 1;
  padding: 0.625rem;
  font-size: 0.8125rem;
  font-weight: 600;
  background-color: var(--bg-card, #ffffff);
  color: var(--color-neutral-500);
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
}

.tab-btn.active {
  background-color: var(--color-primary-50);
  color: var(--color-primary-700);
}

.tab-btn:not(.active):hover {
  background-color: var(--color-neutral-50);
}

.output-badge {
  background-color: var(--color-primary-500);
  color: white;
  font-size: 0.625rem;
  font-weight: 700;
  min-width: 1.125rem;
  height: 1.125rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.25rem;
}

/* ── Playground layout ── */
.playground-layout {
  display: flex;
  gap: 1rem;
  flex: 1;
  min-height: 0;
}

.editor-panel,
.output-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-card, #ffffff);
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ── Editor ── */
.editor-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1rem;
  background-color: var(--color-neutral-800);
  color: white;
  flex-shrink: 0;
}

.editor-dots {
  display: flex;
  gap: 0.375rem;
}

.dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
}

.dot-red { background-color: #ff5f56; }
.dot-yellow { background-color: #ffbd2e; }
.dot-green { background-color: #27c93f; }

.editor-filename {
  font-size: 0.75rem;
  color: var(--color-neutral-400);
  font-family: var(--font-mono);
  flex: 1;
}

.editor-actions {
  display: flex;
  gap: 0.5rem;
}

.clear-btn {
  color: var(--color-neutral-400);
}

.clear-btn:hover {
  color: white;
}

.run-btn {
  background-color: #27c93f;
  color: white;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 0.375rem 0.875rem;
  border-radius: var(--radius-sm);
  gap: 0.375rem;
}

.run-btn:hover {
  background-color: #20b836;
}

.run-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.code-editor {
  flex: 1;
  padding: 1rem;
  font-family: var(--font-mono, 'JetBrains Mono', 'Fira Code', 'Consolas', monospace);
  font-size: 0.875rem;
  line-height: 1.6;
  color: #e4e4e7;
  background-color: #1e1e2e;
  border: none;
  outline: none;
  resize: none;
  tab-size: 4;
  white-space: pre;
  overflow: auto;
}

.code-editor::placeholder {
  color: var(--color-neutral-600);
}

.code-editor:focus {
  box-shadow: none;
}

/* ── Output ── */
.output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 1rem;
  border-bottom: 1px solid var(--color-neutral-200);
  background-color: var(--color-neutral-50);
  flex-shrink: 0;
}

.output-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-neutral-700);
}

.output-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.output-status.running {
  font-size: 0.75rem;
  color: var(--color-primary-600);
  font-weight: 500;
}

.output-content {
  flex: 1;
  overflow: auto;
  padding: 1rem;
  background-color: #0f172a;
  color: #e2e8f0;
  font-family: var(--font-mono, 'JetBrains Mono', 'Fira Code', 'Consolas', monospace);
  font-size: 0.8125rem;
  line-height: 1.6;
}

.output-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.75rem;
  color: var(--color-neutral-400);
}

.output-lines {
  display: flex;
  flex-direction: column;
}

.output-line {
  display: flex;
  gap: 1rem;
  padding: 0.0625rem 0;
}

.output-line.stderr {
  color: #f87171;
}

.line-number {
  color: var(--color-neutral-600);
  user-select: none;
  text-align: right;
  min-width: 1.5rem;
  font-size: 0.75rem;
}

.line-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.output-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-neutral-500);
  text-align: center;
  padding: 2rem;
}

.output-empty.error {
  color: #f87171;
}

/* ── Spinner ── */
.spinner {
  display: inline-block;
  width: 0.875rem;
  height: 0.875rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.spinner-lg {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--color-neutral-700);
  border-top-color: var(--color-primary-500);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Responsive ── */
@media (max-width: 767px) {
  .playground-page {
    height: calc(100vh - var(--header-height, 64px) - 6rem);
  }

  .mobile-tabs {
    display: flex;
  }

  .playground-layout {
    flex-direction: column;
  }

  .mobile-hidden {
    display: none;
  }

  .editor-panel,
  .output-panel {
    flex: 1;
    min-height: 0;
  }

  .examples-bar {
    gap: 0.375rem;
  }

  .example-chip {
    font-size: 0.625rem;
    padding: 0.1875rem 0.625rem;
  }
}
</style>
