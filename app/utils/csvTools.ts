/**
 * CSV tools — pure parser + safe serializer (no DOM, no Nuxt).
 *
 * Parser: RFC 4180 (quoted fields, "" escapes, CRLF/LF, newlines inside
 * quotes), strips a UTF-8 BOM and auto-detects `,` / `;` / tab as delimiter
 * (Excel in Indonesian locale saves CSV with `;`).
 *
 * Serializer: guards against CSV/formula injection — any text cell starting
 * with = + - @ (or tab / carriage return) is prefixed with an apostrophe so
 * spreadsheet apps treat it as text — and prepends a UTF-8 BOM so Excel reads
 * non-ASCII names correctly.
 */

export type CsvDelimiter = ',' | ';' | '\t'
export type CsvCell = string | number | boolean | null | undefined

export interface ParsedCsv {
  headers: string[]
  /** Data rows (header excluded). Each row has the original line number. */
  rows: { line: number; cells: string[] }[]
  delimiter: CsvDelimiter
}

export const UTF8_BOM = '﻿'

/** Pick the delimiter that occurs most often in the first line (outside quotes). */
export function detectCsvDelimiter(text: string): CsvDelimiter {
  const counts: Record<CsvDelimiter, number> = { ',': 0, ';': 0, '\t': 0 }
  let inQuotes = false
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes && (ch === '\n' || ch === '\r')) break
    else if (!inQuotes && (ch === ',' || ch === ';' || ch === '\t')) counts[ch]++
  }
  if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) return ';'
  if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t'
  return ','
}

/**
 * Split CSV text into records. Returns each record with the 1-based line
 * number it started on. Fully empty lines are skipped.
 */
export function parseCsvRecords(text: string, delimiter?: CsvDelimiter): { line: number; cells: string[] }[] {
  let src = text ?? ''
  if (src.startsWith(UTF8_BOM)) src = src.slice(1)
  const delim = delimiter ?? detectCsvDelimiter(src)

  const out: { line: number; cells: string[] }[] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let line = 1
  let rowLine = 1
  let fieldStarted = false

  const pushField = () => {
    row.push(field)
    field = ''
    fieldStarted = false
  }
  const pushRow = () => {
    pushField()
    if (!(row.length === 1 && row[0].trim() === '')) out.push({ line: rowLine, cells: row })
    row = []
  }

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        if (ch === '\n') line++
        field += ch
      }
      continue
    }

    if (ch === '"' && !fieldStarted && field.trim() === '') {
      field = ''
      inQuotes = true
      fieldStarted = true
    } else if (ch === delim) {
      pushField()
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      pushRow()
      line++
      rowLine = line
    } else {
      field += ch
      if (ch.trim() !== '') fieldStarted = true
    }
  }
  if (field !== '' || row.length > 0) pushRow()
  return out
}

/** Parse CSV with a header row. Header names are trimmed. */
export function parseCsvText(text: string, delimiter?: CsvDelimiter): ParsedCsv {
  let src = text ?? ''
  if (src.startsWith(UTF8_BOM)) src = src.slice(1)
  const delim = delimiter ?? detectCsvDelimiter(src)
  const records = parseCsvRecords(src, delim)
  if (records.length === 0) return { headers: [], rows: [], delimiter: delim }
  const [head, ...rest] = records
  return {
    headers: head.cells.map((h) => h.trim()),
    rows: rest.map((r) => ({ line: r.line, cells: r.cells.map((c) => c.trim()) })),
    delimiter: delim,
  }
}

const INJECTION_START = /^[=+\-@\t\r]/

/**
 * Neutralise spreadsheet formula injection: text that starts with
 * = + - @ (or tab / CR) gets a leading apostrophe. Numbers are left alone,
 * so negative numbers stay numeric; a lone "-" placeholder is kept as is.
 */
export function sanitizeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  const s = String(value)
  // A lone "-" / "+" (placeholder for "no value") cannot form a formula.
  if (s === '-' || s === '+') return s
  return INJECTION_START.test(s) ? `'${s}` : s
}

/** Quote a (sanitised) cell when it contains the delimiter, quotes or newlines. */
export function escapeCsvCell(value: CsvCell, delimiter: CsvDelimiter = ','): string {
  const s = sanitizeCsvCell(value)
  if (s.includes('"') || s.includes(delimiter) || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Serialise a table to CSV (CRLF line endings, optional UTF-8 BOM — on by default). */
export function toCsvString(
  headers: string[],
  rows: CsvCell[][],
  options: { delimiter?: CsvDelimiter; bom?: boolean } = {},
): string {
  const delimiter = options.delimiter ?? ','
  const lines = [headers, ...rows].map((r) => r.map((c) => escapeCsvCell(c, delimiter)).join(delimiter))
  return (options.bom === false ? '' : UTF8_BOM) + lines.join('\r\n') + '\r\n'
}
