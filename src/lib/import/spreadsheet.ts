import * as XLSX from "xlsx";

export type Sheet = {
  name: string;
  /** Index of the header row within the original sheet (informational). */
  headerRow: number;
  headers: string[];
  rows: string[][];
};

export const MAX_ROWS = 2000;
export const MAX_COLS = 60;

export class ImportError extends Error {}

function isNumeric(s: string): boolean {
  return /^-?\d+([.,]\d+)?$/.test(s.trim());
}

/**
 * First row with ≥ 2 filled cells, mostly non-numeric, that has data below it.
 * Guest lists often carry a title row or two above the real header.
 */
export function detectHeaderRow(matrix: string[][]): number {
  for (let i = 0; i < matrix.length; i++) {
    const filled = matrix[i].filter((c) => c !== "");
    if (filled.length < 2) continue;
    const labelish = filled.filter((c) => !isNumeric(c)).length / filled.length;
    if (labelish < 0.6) continue;
    const hasDataBelow = matrix.slice(i + 1).some((r) => r.some((c) => c !== ""));
    if (hasDataBelow) return i;
  }
  return 0;
}

function columnLetter(i: number): string {
  let s = "";
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
}

function cleanHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    let name = h.replace(/\s+/g, " ").trim() || `Column ${columnLetter(i)}`;
    const n = (seen.get(name.toLowerCase()) ?? 0) + 1;
    seen.set(name.toLowerCase(), n);
    if (n > 1) name = `${name} (${n})`;
    return name;
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function cellToString(c: unknown): string {
  if (c == null) return "";
  if (c instanceof Date) {
    if (Number.isNaN(c.getTime())) return "";
    return `${c.getFullYear()}-${pad2(c.getMonth() + 1)}-${pad2(c.getDate())}`;
  }
  return String(c).replace(/\s+/g, " ").trim();
}

function toMatrix(ws: XLSX.WorkSheet): string[][] {
  // raw values (not display text) so a date-formatted cell reaches us as a Date,
  // not as whatever short format the spreadsheet author picked
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true, blankrows: true });
  return aoa.map((row) => (row as unknown[]).slice(0, MAX_COLS).map(cellToString));
}

export function parseWorkbook(buffer: ArrayBuffer | Uint8Array, filename: string): Sheet[] {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer), { type: "array", cellDates: true });
  } catch {
    throw new ImportError(`Could not read ${filename} — is it an Excel or CSV export?`);
  }

  const sheets: Sheet[] = [];
  for (const name of wb.SheetNames) {
    const matrix = toMatrix(wb.Sheets[name]);
    if (!matrix.some((r) => r.some((c) => c !== ""))) continue;
    const headerRow = detectHeaderRow(matrix);
    const width = Math.max(...matrix.map((r) => r.length));
    const pad = (r: string[]) => [...r, ...Array(Math.max(0, width - r.length)).fill("")];
    const headers = cleanHeaders(pad(matrix[headerRow]));
    const rows = matrix
      .slice(headerRow + 1)
      .map(pad)
      .filter((r) => r.some((c) => c !== ""))
      .slice(0, MAX_ROWS);
    if (rows.length === 0) continue;
    sheets.push({ name, headerRow, headers, rows });
  }
  if (sheets.length === 0) throw new ImportError(`No data found in ${filename} — it needs a header row and at least one guest.`);
  return sheets;
}

/**
 * Workbooks often open with a cover or notes sheet. Default to the sheet holding
 * the most cells, which is almost always the actual guest list.
 */
export function defaultSheetIndex(sheets: Sheet[]): number {
  let best = 0, bestScore = -1;
  sheets.forEach((s, i) => {
    const score = s.rows.length * s.headers.length;
    if (score > bestScore) { best = i; bestScore = score; }
  });
  return best;
}
