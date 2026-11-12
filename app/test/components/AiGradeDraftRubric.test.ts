/**
 * AiGradeDraft with a structured rubric — Component Tests (Prioritas 3)
 *
 * Sends `rubric_criteria` (not the free-text rubric), shows the suggested level
 * + reason per criterion and emits the level selection with "Gunakan saran".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AiGradeDraft from '~/components/assignments/AiGradeDraft.vue'

const fetchMock = vi.fn()
;(globalThis as any).$fetch = fetchMock

const RUBRIC = [
  { id: 'c1', nama: 'Ketepatan', deskripsi: '', bobot: 60, levels: [{ id: 'l1', label: 'Baik', deskripsi: '', poin: 2 }, { id: 'l2', label: 'Kurang', deskripsi: '', poin: 1 }] },
  { id: 'c2', nama: 'Kerapian', deskripsi: '', bobot: 40, levels: [{ id: 'l3', label: 'Rapi', deskripsi: '', poin: 2 }, { id: 'l4', label: 'Berantakan', deskripsi: '', poin: 0 }] },
]

const DRAFT = {
  nilai_saran: 70,
  feedback: 'Bagus.',
  kekuatan: [],
  perbaikan: [],
  flags: [],
  source: 'ai',
  rubrik: { kriteria: [{ criterion_id: 'c1', level_id: 'l2', alasan: 'Sebagian benar.' }, { criterion_id: 'c2', level_id: 'l3', alasan: 'Indentasi konsisten.' }], skor: 70 },
}

const props = { judul: 'T', deskripsi: 'D', submissionText: 'print(1)', hasFile: false, currentScore: 0, currentFeedback: '', rubric: RUBRIC }

describe('AiGradeDraft — rubric mode', () => {
  beforeEach(() => fetchMock.mockReset())

  it('posts rubric_criteria and hides the free-text rubric field', async () => {
    const w = mount(AiGradeDraft, { props })
    expect(w.find('textarea').exists()).toBe(false)
    expect(w.text()).toContain('Memakai rubrik tugas (2 kriteria)')
    fetchMock.mockResolvedValueOnce(DRAFT)
    await w.find('button.aigd-btn').trigger('click')
    await flushPromises()
    const body = fetchMock.mock.calls[0]![1].body
    expect(body.rubric).toBeUndefined()
    expect(body.rubric_criteria.map((c: any) => c.id)).toEqual(['c1', 'c2'])
    expect(body.rubric_criteria[0].levels[0]).toEqual({ id: 'l1', label: 'Baik', deskripsi: '', poin: 2 })
  })

  it('shows level + reason per criterion and emits the selection', async () => {
    fetchMock.mockResolvedValueOnce(DRAFT)
    const w = mount(AiGradeDraft, { props })
    await w.find('button.aigd-btn').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Saran level per kriteria')
    expect(w.text()).toContain('Kurang · 1 poin')
    expect(w.text()).toContain('Indentasi konsisten.')
    expect(w.text()).toContain('Skor rubrik')
    await w.findAll('button').find((b) => b.text().includes('Gunakan saran'))!.trigger('click')
    const ev = w.emitted('apply')![0]![0] as any
    expect(ev.nilai).toBe(70)
    expect(ev.selection).toEqual({ c1: 'l2', c2: 'l3' })
    expect(w.text()).toContain('BELUM disimpan')
  })

  it('without a rubric the emitted payload has no selection (legacy)', async () => {
    fetchMock.mockResolvedValueOnce({ ...DRAFT, rubrik: undefined })
    const w = mount(AiGradeDraft, { props: { ...props, rubric: null } })
    expect(w.find('textarea').exists()).toBe(true)
    await w.find('button.aigd-btn').trigger('click')
    await flushPromises()
    await w.findAll('button').find((b) => b.text().includes('Gunakan saran'))!.trigger('click')
    expect(w.emitted('apply')![0]![0]).toEqual({ nilai: 70, feedback: 'Bagus.' })
  })
})
