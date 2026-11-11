/**
 * AiGradeDraft — Component Tests
 *
 * The component must never save anything: it only emits `apply`. Checks the
 * request payload (no student identifiers), rendering of the draft and flags,
 * the overwrite confirmation, the no-text state and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AiGradeDraft from '~/components/assignments/AiGradeDraft.vue'

const fetchMock = vi.fn()
;(globalThis as any).$fetch = fetchMock

const DRAFT = {
  nilai_saran: 72,
  feedback: 'Kamu sudah membuat fungsi tambah.',
  kekuatan: ['Kode rapi'],
  perbaikan: ['Tambahkan pembagian'],
  catatan: 'Catatan dosen',
  flags: [] as string[],
  source: 'ai' as const,
}

const baseProps = {
  judul: 'Tugas 2',
  deskripsi: 'Buat kalkulator',
  submissionText: 'def tambah(a, b): return a + b',
  hasFile: false,
  currentScore: 0,
  currentFeedback: '',
}

async function mountAndRequest(props = {}, reply: any = DRAFT) {
  fetchMock.mockResolvedValueOnce(reply)
  const w = mount(AiGradeDraft, { props: { ...baseProps, ...props }, attachTo: document.body })
  await w.find('button.aigd-btn').trigger('click')
  await flushPromises()
  return w
}

const button = (w: any, label: string) => w.findAll('button').find((b: any) => b.text().includes(label))

describe('AiGradeDraft', () => {
  beforeEach(() => fetchMock.mockReset())

  it('posts only assignment text, rubric and answer text', async () => {
    const w = mount(AiGradeDraft, { props: baseProps })
    await w.find('textarea').setValue('Ketepatan 50, kerapian 50')
    fetchMock.mockResolvedValueOnce(DRAFT)
    await w.find('button.aigd-btn').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/ai/grade-draft', {
      method: 'POST',
      body: {
        assignment: { judul: 'Tugas 2', deskripsi: 'Buat kalkulator' },
        submission: { text: 'def tambah(a, b): return a + b' },
        rubric: 'Ketepatan 50, kerapian 50',
        max_score: 100,
      },
    })
  })

  it('renders the draft as text with the review label, and does not emit until "Gunakan saran"', async () => {
    const w = await mountAndRequest({}, { ...DRAFT, feedback: '<img src=x onerror=alert(1)>' })
    expect(w.text()).toContain('Draf AI — periksa sebelum menyimpan')
    expect(w.text()).toContain('72')
    expect(w.find('img').exists()).toBe(false)
    expect(w.text()).toContain('<img src=x onerror=alert(1)>')
    expect(w.emitted('apply')).toBeUndefined()

    await button(w, 'Gunakan saran').trigger('click')
    const [[payload]] = w.emitted('apply') as any
    expect(payload.nilai).toBe(72)
    expect(payload.feedback).toContain('Kekuatan:\n- Kode rapi')
    expect(payload.feedback).not.toContain('Catatan dosen')
    expect(w.text()).toContain('BELUM disimpan')
  })

  it('labels demo drafts and shows the injection warning', async () => {
    const w = await mountAndRequest({}, { ...DRAFT, source: 'demo', flags: ['possible_prompt_injection', 'ai_unavailable_fallback'] })
    expect(w.text()).toContain('Draf DEMO (heuristik kasar, bukan AI)')
    expect(w.find('.aigd-warning').text()).toContain('Kemungkinan upaya manipulasi penilaian')
    expect(w.text()).toContain('Layanan AI sedang tidak tersedia')
  })

  it('asks before overwriting fields the instructor already filled', async () => {
    const w = await mountAndRequest({ currentScore: 90, currentFeedback: 'Tulisan saya' })
    await button(w, 'Gunakan saran').trigger('click')
    expect(w.emitted('apply')).toBeUndefined()
    expect(w.text()).toContain('sudah berisi')

    await button(w, 'tambahkan feedback').trigger('click')
    const [[payload]] = w.emitted('apply') as any
    expect(payload.feedback.startsWith('Tulisan saya\n\nKamu sudah')).toBe(true)
    expect(payload.nilai).toBe(72)
  })

  it('disables the button for answers without text', () => {
    const w = mount(AiGradeDraft, { props: { ...baseProps, submissionText: '', hasFile: true } })
    expect(w.find('button.aigd-btn').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('hanya berupa file')
  })

  it.each([
    [{ statusCode: 429, data: { message: 'Batas harian penggunaan AI telah tercapai.' } }, 'Batas harian'],
    [{ statusCode: 403 }, 'hanya tersedia untuk instruktur'],
    [{ statusCode: 422, data: { message: 'Jawaban ini tidak berisi teks' } }, 'tidak berisi teks'],
    [new TypeError('fetch failed'), 'Tidak dapat terhubung'],
  ])('shows an Indonesian error with retry (%#)', async (err, text) => {
    fetchMock.mockRejectedValueOnce(err)
    const w = mount(AiGradeDraft, { props: baseProps })
    await w.find('button.aigd-btn').trigger('click')
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toContain(text)
    fetchMock.mockResolvedValueOnce(DRAFT)
    await button(w, 'Coba lagi').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Saran nilai')
  })

  it('"Tutup" clears the draft', async () => {
    const w = await mountAndRequest()
    await button(w, 'Tutup').trigger('click')
    expect(w.find('.aigd-result').exists()).toBe(false)
    expect(w.find('button.aigd-btn').exists()).toBe(true)
  })
})
