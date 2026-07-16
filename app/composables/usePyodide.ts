/**
 * usePyodide — Composable for running Python code in the browser via Pyodide (WebAssembly).
 *
 * Loads Pyodide on demand from CDN, executes Python code, and captures stdout/stderr.
 * All processing happens client-side — no server calls required.
 *
 * Usage:
 *   const { state, runCode, init } = usePyodide()
 *   await init()
 *   const { output, error } = await runCode('print("hello")')
 */

interface PyodideState {
  ready: boolean
  loading: boolean
  error: string | null
}

let pyodideInstance: any = null
let loadPromise: Promise<any> | null = null

export function usePyodide() {
  const state = reactive<PyodideState>({
    ready: false,
    loading: false,
    error: null,
  })

  const stdout = ref('')
  const stderr = ref('')

  /**
   * Dynamically load the Pyodide script and initialize the Python runtime.
   * Safe to call multiple times — returns the same promise if already loading.
   */
  async function init(): Promise<any> {
    if (pyodideInstance) {
      state.ready = true
      return pyodideInstance
    }
    if (loadPromise) {
      return loadPromise
    }

    state.loading = true
    state.error = null

    loadPromise = (async () => {
      try {
        // Inject Pyodide script tag
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js'
        document.head.appendChild(script)

        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Gagal memuat Pyodide'))
        })

        // Initialize Pyodide runtime
        pyodideInstance = await (window as any).loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/',
        })

        state.ready = true
        return pyodideInstance
      } catch (e: any) {
        state.error = e.message || 'Gagal memuat Python runtime'
        loadPromise = null
        throw e
      } finally {
        state.loading = false
      }
    })()

    return loadPromise
  }

  /**
   * Execute Python code and capture stdout/stderr output.
   * Automatically initializes Pyodide if not already loaded.
   */
  async function runCode(code: string): Promise<{ output: string; error: string | null }> {
    stdout.value = ''
    stderr.value = ''
    state.error = null

    try {
      const pyodide = await init()

      // Redirect stdout/stderr to capture output
      pyodide.runPython(`
import sys
from io import StringIO
_stdout = StringIO()
_stderr = StringIO()
sys.stdout = _stdout
sys.stderr = _stderr
      `)

      // Execute user code
      await pyodide.runPythonAsync(code)

      // Capture and restore
      const out = pyodide.runPython('_stdout.getvalue()')
      const err = pyodide.runPython('_stderr.getvalue()')
      pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
      `)

      stdout.value = out || ''
      stderr.value = err || ''

      return {
        output: stdout.value,
        error: stderr.value || null,
      }
    } catch (e: any) {
      const msg = e.message || 'Terjadi kesalahan saat menjalankan kode'
      stderr.value = msg
      state.error = msg
      return { output: '', error: msg }
    }
  }

  return {
    state: state as Readonly<Ref<PyodideState>>,
    stdout,
    stderr,
    init,
    runCode,
  }
}
