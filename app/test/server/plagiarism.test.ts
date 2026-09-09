/**
 * Plagiarism Utility — Unit Tests
 *
 * Tests the pure text-similarity algorithm: tokenization, shingles,
 * Jaccard similarity, and the submission comparison helper.
 */
import { describe, it, expect } from 'vitest'
import {
  tokenize,
  shingles,
  jaccard,
  textSimilarity,
  severityLabel,
  checkSubmissionAgainst,
  type SubmissionLike,
} from '../../../server/utils/plagiarism'

describe('tokenize', () => {
  it('lowercases and splits on non-alphanumeric characters', () => {
    expect(tokenize('Hello, World! print("Hi")')).toEqual(['hello', 'world', 'print', 'hi'])
  })

  it('returns an empty array for empty/whitespace input', () => {
    expect(tokenize('')).toEqual([])
    expect(tokenize('   ')).toEqual([])
  })

  it('keeps digits and normalizes camelCase into separate tokens', () => {
    expect(tokenize('bubbleSort2025 OK')).toEqual(['bubblesort2025', 'ok'])
  })
})

describe('shingles', () => {
  it('builds overlapping n-grams', () => {
    const tokens = ['a', 'b', 'c', 'd']
    expect(shingles(tokens, 3)).toEqual(['a b c', 'b c d'])
  })

  it('returns a single shingle when the text is shorter than n', () => {
    expect(shingles(['a', 'b'], 3)).toEqual(['a b'])
  })

  it('returns an empty array for no tokens', () => {
    expect(shingles([], 3)).toEqual([])
  })
})

describe('jaccard', () => {
  it('returns 0 for disjoint sets', () => {
    expect(jaccard(['a'], ['b'])).toBe(0)
  })

  it('returns 1 for identical sets', () => {
    expect(jaccard(['a', 'b'], ['b', 'a'])).toBe(1)
  })

  it('returns partial similarity for overlapping sets', () => {
    expect(jaccard(['a', 'b', 'c'], ['a', 'b', 'd'])).toBeCloseTo(0.5)
  })

  it('returns 0 when both sets are empty', () => {
    expect(jaccard([], [])).toBe(0)
  })
})

describe('textSimilarity', () => {
  it('detects identical text as 100%', () => {
    const text = 'def kalkulator():\n    a = 10\n    b = 20\n    return a + b\n'
    expect(textSimilarity(text, text)).toBe(100)
  })

  it('detects heavily overlapping text with a high score', () => {
    const a = 'def kalkulator(a, b): return a + b'
    const b = 'def kalkulator(a, b):\n    hasil = a + b\n    return hasil'
    expect(textSimilarity(a, b)).toBeGreaterThanOrEqual(30)
  })

  it('returns 0 for completely different text', () => {
    expect(textSimilarity('lorem ipsum dolor sit amet', 'xyz qwerty asdfgh')).toBe(0)
  })

  it('is insensitive to casing and punctuation', () => {
    const a = 'def hitung_total(a, b):\n    return a + b'
    const b = 'def Hitung_Total (a, b):\n    return a + b'
    expect(textSimilarity(a, b)).toBe(100)
  })

  it('handles empty inputs without throwing', () => {
    expect(textSimilarity('', '')).toBe(0)
    expect(textSimilarity('some text here', '')).toBe(0)
  })
})

describe('severityLabel', () => {
  it('labels high / medium / low severities', () => {
    expect(severityLabel(85)).toBe('tinggi')
    expect(severityLabel(60)).toBe('sedang')
    expect(severityLabel(10)).toBe('rendah')
    expect(severityLabel(75)).toBe('tinggi')
    expect(severityLabel(40)).toBe('sedang')
  })
})

describe('checkSubmissionAgainst', () => {
  const peers: SubmissionLike[] = [
    {
      id: 's1',
      student_id: 'st1',
      student_name: 'Ahmad',
      jawaban: 'Fungsi hitungRataRata menerima daftar angka.\nHitung total dengan perulangan.\nBagi total dengan jumlah elemen pada daftar.\nKembalikan hasil pembagian total.\n',
    },
    {
      id: 's2',
      student_id: 'st2',
      student_name: 'Budi',
      jawaban: 'Fungsi hitungRataRata menerima daftar angka.\nHitung total memakai perulangan.\nBagi total dengan jumlah elemen pada array.\nKembalikan hasil dari pembagian tersebut.\n',
    },
    {
      id: 's3',
      student_id: 'st3',
      student_name: 'Citra',
      jawaban: 'Kelas ini membahas tentang struktur data queue.\nImplementasi menggunakan linked list saja.\n',
    },
    {
      id: 's4',
      student_id: 'st4',
      student_name: 'Dian',
      jawaban: 'Poster membahas tema kesehatan lingkungan sekitar.\nWarna diambil dari palet hijau kebiruan.\n',
    },
  ]

  it('ranks and reports matches for similar peers, sorted by score', () => {
    const result = checkSubmissionAgainst('s1', 'Ahmad', peers[0].jawaban || '', peers)
    const s2match = result.matches.find((m) => m.withId === 's2')
    expect(s2match).toBeDefined()
    expect(s2match!.score).toBeGreaterThan(0)
    const scores = result.matches.map((m) => m.score)
    expect([...scores].sort((x, y) => y - x)).toEqual(scores)
  })

  it('excludes the submission itself', () => {
    const result = checkSubmissionAgainst('s3', 'Citra', peers[2].jawaban || '', peers)
    expect(result.matches.every((m) => m.withId !== 's3')).toBe(true)
  })

  it('returns highestScore of 0 when there are no matches', () => {
    const result = checkSubmissionAgainst('s1', 'Ahmad', 'unique phrase alpha beta gamma', [
      { id: 's2', student_id: 'st2', student_name: 'Budi', jawaban: 'zzz yyy xxx www vvv' },
    ])
    expect(result.highestScore).toBe(0)
    expect(result.matches).toEqual([])
  })
})