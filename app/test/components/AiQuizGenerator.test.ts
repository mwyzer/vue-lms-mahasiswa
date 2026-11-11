/**
 * AiQuizGenerator — Component Tests
 *
 * Lesson picker (short lessons disabled), generate → review → edit/deselect →
 * save through quizStore.addQuestionsBulk, demo labelling, shortfall notice,
 * error messages, and that nothing is saved before the explicit add step.
 * `$fetch` is mocked; no server is involved.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { onMounted, onBeforeUnmount } from 'vue'
import AiQuizGenerator from '~/components/quiz/AiQuizGenerator.vue'
import { useQuizStore } from '~/stores/quiz'
import { useCoursesStore } from '~/stores/courses'
import { useUiStore } from '~/stores/ui'
import type { Lesson } from '~/types/database'

;(globalThis as any).onMounted = onMounted
;(globalThis as any).onBeforeUnmount = onBeforeUnmount

const LONG = 'Perulangan while berjalan selama kondisi bernilai True dan berhenti ketika kondisi bernilai False. '.repeat(3)
const LESSONS: Lesson[] = [
  { id: 'l1', course_id: 'c1', judul: 'Pengantar', konten: 'Apa itu pemrograman?', urutan: 1, created_at: '', updated_at: '' },
  { id: 'l4', course_id: 'c1', judul: 'Perulangan', konten: LONG, urutan: 4, created_at: '', updated_at: '' },
]

const q = (n: number, over: Record<string, unknown> = {}) => ({
  pertanyaan: `Pertanyaan nomor ${n}?`,
  pilihan_a: `A${n}`,
  pilihan_b: `B${n}`,
  pilihan_c: `C${n}`,
  pilihan_d: `D${n}`,
  jawaban_benar: 'b',
  penjelasan: `Penjelasan ${n}`,
  ...over,
})

let fetchMock: ReturnType<typeof vi.fn>

async function mountGenerator() {
  const quiz = useQuizStore()
  await quiz.init()
  const courses = useCoursesStore()
  await courses.init()
  const wrapper = mount(AiQuizGenerator, { props: { quizId: 'qz2', courseId: 'c1' }, attachTo: document.body })
  await flushPromises()
  courses.lessons = LESSONS
  await flushPromises()
  return { wrapper, quiz }
}

async function generate(wrapper: Awaited<ReturnType<typeof mountGenerator>>['wrapper']) {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  fetchMock = vi.fn()
  ;(globalThis as any).$fetch = fetchMock
})
afterEach(() => {
  document.body.innerHTML = ''
})

describe('AiQuizGenerator', () => {
  it('disables lessons whose content is too short and preselects a usable one', async () => {
    const { wrapper } = await mountGenerator()
    const options = wrapper.findAll('select option')
    expect(options[0]!.attributes('disabled')).toBeDefined()
    expect(options[0]!.text()).toMatch(/terlalu pendek/)
    expect(options[1]!.attributes('disabled')).toBeUndefined()
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('l4')
  })

  it('sends lesson, clamped count, difficulty and existing questions', async () => {
    fetchMock.mockResolvedValue({ questions: [q(1)], source: 'ai', requested: 1, generated: 1 })
    const { wrapper, quiz } = await mountGenerator()
    await wrapper.find('input[type="number"]').setValue(40)
    await wrapper.find('input[value="sulit"]').setValue(true)
    await generate(wrapper)
    const [url, opts] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/ai/generate-quiz')
    expect(opts.method).toBe('POST')
    expect(opts.body).toMatchObject({ lesson: { judul: 'Perulangan', konten: LONG }, count: 10, difficulty: 'sulit' })
    expect(opts.body.existing).toEqual(quiz.questionsForQuiz('qz2').map((x) => x.pertanyaan))
  })

  it('review: edit + deselect, then saves only the selected, edited questions', async () => {
    fetchMock.mockResolvedValue({ questions: [q(1), q(2), q(3)], source: 'ai', requested: 3, generated: 3 })
    const { wrapper, quiz } = await mountGenerator()
    const before = quiz.questionsForQuiz('qz2').length
    await generate(wrapper)

    // Nothing saved yet.
    expect(quiz.questionsForQuiz('qz2')).toHaveLength(before)
    const drafts = wrapper.findAll('.aiq-draft')
    expect(drafts).toHaveLength(3)
    expect(wrapper.text()).toContain('Penjelasan 2')

    await drafts[0]!.find('textarea').setValue('Pertanyaan yang diedit?')
    await drafts[0]!.find('input[type="radio"][value="d"]').setValue(true)
    await drafts[1]!.find('input[type="checkbox"]').setValue(false)

    const addBtn = wrapper.findAll('button').find((b) => /Tambahkan \d+ soal ke kuis/.test(b.text()))!
    expect(addBtn.text()).toBe('Tambahkan 2 soal ke kuis')
    await addBtn.trigger('click')
    await flushPromises()

    const after = quiz.questionsForQuiz('qz2')
    expect(after).toHaveLength(before + 2)
    const added = after.slice(-2)
    expect(added[0]).toMatchObject({ pertanyaan: 'Pertanyaan yang diedit?', jawaban_benar: 'd', pilihan_d: 'D1' })
    expect(added[1]).toMatchObject({ pertanyaan: 'Pertanyaan nomor 3?', jawaban_benar: 'b' })
    expect(added.some((x) => 'penjelasan' in x)).toBe(false)
    expect(wrapper.emitted('added')).toEqual([[2]])
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('blocks saving a selected draft that became invalid (duplicate options / duplicate of quiz)', async () => {
    fetchMock.mockResolvedValue({ questions: [q(1), q(2)], source: 'ai', requested: 2, generated: 2 })
    const { wrapper, quiz } = await mountGenerator()
    const before = quiz.questionsForQuiz('qz2').length
    await generate(wrapper)
    const drafts = wrapper.findAll('.aiq-draft')
    await drafts[0]!.findAll('input[type="text"]')[1]!.setValue(' a1 ')
    await drafts[1]!.find('textarea').setValue(quiz.questionsForQuiz('qz2')[0]!.pertanyaan.toUpperCase())
    expect(wrapper.text()).toContain('Keempat pilihan jawaban harus berbeda.')
    expect(wrapper.text()).toContain('Soal ini sudah ada di kuis.')
    const addBtn = wrapper.findAll('button').find((b) => /Tambahkan/.test(b.text()))!
    expect(addBtn.attributes('disabled')).toBeDefined()
    // Deselecting the broken ones leaves nothing to add.
    await drafts[0]!.find('input[type="checkbox"]').setValue(false)
    await drafts[1]!.find('input[type="checkbox"]').setValue(false)
    expect(addBtn.text()).toBe('Tambahkan 0 soal ke kuis')
    expect(addBtn.attributes('disabled')).toBeDefined()
    expect(quiz.questionsForQuiz('qz2')).toHaveLength(before)
  })

  it('labels demo output and reports a shortfall', async () => {
    fetchMock.mockResolvedValue({ questions: [q(1), q(2)], source: 'demo', requested: 5, generated: 2 })
    const { wrapper } = await mountGenerator()
    await generate(wrapper)
    expect(wrapper.find('.aiq-badge-demo').text()).toBe('contoh (mode demo)')
    expect(wrapper.text()).toContain('Hanya 2 dari 5 soal yang berhasil dibuat')
  })

  it('regenerates the whole batch with a fresh seed', async () => {
    fetchMock
      .mockResolvedValueOnce({ questions: [q(1)], source: 'demo', requested: 1, generated: 1 })
      .mockResolvedValueOnce({ questions: [q(7), q(8)], source: 'demo', requested: 2, generated: 2 })
    const { wrapper } = await mountGenerator()
    await generate(wrapper)
    await wrapper.findAll('button').find((b) => /Buat ulang semua/.test(b.text()))!.trigger('click')
    await flushPromises()
    expect(typeof fetchMock.mock.calls[1]![1].body.seed).toBe('number')
    expect(wrapper.findAll('.aiq-draft')).toHaveLength(2)
    expect((wrapper.find('.aiq-draft textarea').element as HTMLTextAreaElement).value).toBe('Pertanyaan nomor 7?')
  })

  it.each([
    [{ statusCode: 429, data: { message: 'Batas harian penggunaan AI telah tercapai. Coba lagi besok.' } }, 'Batas harian penggunaan AI'],
    [{ statusCode: 403, data: {} }, 'Akses ditolak'],
    [{ statusCode: 422, data: { message: 'Materi terlalu pendek atau kurang bervariasi' } }, 'Materi terlalu pendek'],
    [new TypeError('fetch failed'), 'Gagal membuat soal'],
  ])('shows an Indonesian error with a retry button (%#)', async (err, text) => {
    fetchMock.mockRejectedValueOnce(err).mockResolvedValueOnce({ questions: [q(1)], source: 'ai', requested: 1, generated: 1 })
    const { wrapper } = await mountGenerator()
    await generate(wrapper)
    const alert = wrapper.find('[role="alert"]')
    expect(alert.text()).toContain(text)
    await alert.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.aiq-draft')).toHaveLength(1)
  })

  it('ignores a double submit while loading', async () => {
    let resolve!: (v: unknown) => void
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)))
    const { wrapper } = await mountGenerator()
    await wrapper.find('form').trigger('submit')
    await wrapper.find('form').trigger('submit')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('button[type="submit"].btn-primary').attributes('disabled')).toBeDefined()
    resolve({ questions: [q(1)], source: 'ai', requested: 1, generated: 1 })
    await flushPromises()
  })

  it('closes on Escape', async () => {
    const { wrapper } = await mountGenerator()
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('toast reports how many were added', async () => {
    fetchMock.mockResolvedValue({ questions: [q(1)], source: 'ai', requested: 1, generated: 1 })
    const { wrapper } = await mountGenerator()
    await generate(wrapper)
    await wrapper.findAll('button').find((b) => /Tambahkan/.test(b.text()))!.trigger('click')
    await flushPromises()
    expect(useUiStore().activeToasts.map((t: any) => t.message)).toContain('1 soal berhasil ditambahkan ke kuis.')
  })
})
