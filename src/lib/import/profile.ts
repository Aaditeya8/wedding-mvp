import type { Sheet } from "./spreadsheet";
import { parseBoolean } from "./targets";

export type ColumnKind = "email" | "phone" | "number" | "boolean" | "text" | "empty";

export type ColumnProfile = {
  index: number;
  header: string;
  /** Up to five distinct non-empty values, in sheet order. This is all the AI ever sees. */
  samples: string[];
  /** Count of non-empty cells. */
  filled: number;
  fillRate: number;
  distinct: number;
  kind: ColumnKind;
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+(]?\d[\d\s().-]{6,}$/;
const NUMBER_RE = /^-?\d+([.,]\d+)?$/;

function kindOf(values: string[]): ColumnKind {
  if (values.length === 0) return "empty";
  const share = (re: RegExp) => values.filter((v) => re.test(v)).length / values.length;
  if (share(EMAIL_RE) >= 0.6) return "email";
  if (share(PHONE_RE) >= 0.6) return "phone";
  if (values.every((v) => parseBoolean(v) !== null)) return "boolean";
  if (values.every((v) => NUMBER_RE.test(v))) return "number";
  return "text";
}

export function profileColumns(sheet: Sheet): ColumnProfile[] {
  return sheet.headers.map((header, index) => {
    const values = sheet.rows.map((r) => r[index] ?? "").filter((v) => v !== "");
    const distinctValues = [...new Set(values)];
    return {
      index,
      header,
      samples: distinctValues.slice(0, 5),
      filled: values.length,
      fillRate: sheet.rows.length ? values.length / sheet.rows.length : 0,
      distinct: distinctValues.length,
      kind: kindOf(values),
    };
  });
}
