/**
 * Unit tests for quiz CSV parsing + bulk import.
 */
import { describe, it, expect } from 'vitest'
import { parseQuestionsCsv, useQuizStore } from '../../stores/quiz'

describe('parseQuestionsCsv', () => {
  it('parses CSV with header, skipping the header row', () => {
    const csv = [
      'pertanyaan,pilihan_a,pilihan_b,pilihan_c,pilihan_d,jawaban_benar',
      'Siapa presiden pertama?,Soekarno,Hatta,Suharto,Habibie,a',
      'Berapa 2+2?,2,3,4,5,c',
    ].join('\n')

    const rows = parseQuestionsCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ pertanyaan: 'Siapa presiden pertama?', jawaban_benar: 'a' })
    expect(rows[1]).toMatchObject({ pertanyaan: 'Berapa 2+2?', pilihan_c: '4', jawaban_benar: 'c' })
  })

  it('parses CSV without header', () => {
    const csv = 'A,op1,op2,op3,op4,b\nB,op1,op2,op3,op4,d'
    const rows = parseQuestionsCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0].pertanyaan).toBe('A')
    expect(rows[1].jawaban_benar).toBe('d')
  })

  it('handles quoted fields containing commas', () => {
    const csv = '"Pertanyaan, dengan koma",a1,b1,c1,d1,a'
    const rows = parseQuestionsCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].pertanyaan).toBe('Pertanyaan, dengan koma')
  })

  it('handles double quotes inside quoted fields', () => {
    const csv = '"Dia berkata ""halo""",a1,b1,c1,d1,a'
    const rows = parseQuestionsCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].pertanyaan).toBe('Dia berkata "halo"')
  })

  it('normalizes jawaban_benar to lowercase', () => {
    const csv = 'Q,a1,b1,c1,d1,B'
    const rows = parseQuestionsCsv(csv)
    expect(rows[0].jawaban_benar).toBe('b')
  })

  it('skips rows with invalid answer or missing columns', () => {
    const csv = [
      'Q1,a1,b1,c1,d1,x',        // invalid answer
      'Q2,a2,b2,c2,d2',          // missing answer column
      'Q3,a3,b3,,d3,b',          // empty option
      'Q4,a4,b4,c4,d4,a',        // valid
      '',                        // empty row
    ].join('\n')
    const rows = parseQuestionsCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].pertanyaan).toBe('Q4')
  })

  it('strips BOM prefix', () => {
    const rows = parseQuestionsCsv('\uFEFFQ,a,b,c,d,a')
    expect(rows).toHaveLength(1)
    expect(rows[0].pertanyaan).toBe('Q')
  })
})

describe('quiz store addQuestionsBulk', () => {
  it('adds multiple questions to a quiz with correct urutan in demo mode', async () => {
    const store = useQuizStore()
    await store.init()

    const before = store.questions.filter((q) => q.quiz_id === 'qz4').length
    const added = await store.addQuestionsBulk('qz4', [
      { pertanyaan: 'Soal impor 1', pilihan_a: 'a', pilihan_b: 'b', pilihan_c: 'c', pilihan_d: 'd', jawaban_benar: 'a' },
      { pertanyaan: 'Soal impor 2', pilihan_a: 'a', pilihan_b: 'b', pilihan_c: 'c', pilihan_d: 'd', jawaban_benar: 'b' },
    ])

    expect(added).toBe(2)
    const questions = store.questions.filter((q) => q.quiz_id === 'qz4')
    expect(questions).toHaveLength(before + 2)
    expect(questions[before].urutan).toBe(before + 1)
    expect(questions[before + 1].urutan).toBe(before + 2)
  })
})