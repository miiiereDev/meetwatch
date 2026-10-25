import Papa from 'papaparse';

export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

/** Parses CSV text (tolerant of BOM, CRLF, quoted fields) into rows. */
export function parseCsv(text: string): CsvTable {
  const cleaned = text.replace(/^\uFEFF/, '');
  const result = Papa.parse<string[]>(cleaned, {
    skipEmptyLines: 'greedy',
  });
  const data = result.data.filter((row) => row.length > 0);
  if (data.length === 0) return { headers: [], rows: [] };
  const headers = (data[0] ?? []).map((h) => h.trim());
  const rows = data.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = (cells[i] ?? '').trim();
    });
    return row;
  });
  return { headers, rows };
}

/**
 * Finds the first header matching any of the given aliases, ignoring case,
 * accents, and punctuation, so localized or renamed columns still work.
 */
export function pickColumn(row: Record<string, string>, aliases: string[]): string | undefined {
  for (const alias of aliases) {
    for (const header of Object.keys(row)) {
      if (normalizeHeader(header) === normalizeHeader(alias)) {
        const value = row[header];
        if (value !== undefined && value !== '') return value;
      }
    }
  }
  return undefined;
}

function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return Papa.unparse(rows, { newline: '\r\n' });
}
