/** Sheet date parse/format helpers (dd-Month-yyyy, e.g. 19-May-2026). */

import { format, parse, isValid } from "date-fns";
import { SHEET_DATE_FORMAT } from "./constants";
import { computeTatFromDates, loadPublicHolidays } from "./tat";

const PARSE_FORMATS = [
  SHEET_DATE_FORMAT, // dd-MMMM-yyyy
  "MMMM, dd'' yy",
  "MMMM d, yyyy",
  "yyyy-MM-dd",
  "MMMM-dd-yyyy",
  "MMMM-dd-yy",
  "MMM-dd-yy",
  "MM/dd/yyyy",
  "dd/MM/yyyy",
  "dd-MMM-yyyy",
  "d MMMM yyyy",
];

const EXCEL_EPOCH = new Date(1899, 11, 30);

export function colIndexToLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export function parseSheetDateValue(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date && isValid(value)) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(EXCEL_EPOCH.getTime() + value * 86400000);
    return isValid(d) ? d : null;
  }

  const text = String(value).trim();
  if (!text || text === "-") return null;

  if (/^\d+(\.\d+)?$/.test(text)) {
    const d = new Date(EXCEL_EPOCH.getTime() + Number(text) * 86400000);
    if (isValid(d)) return d;
  }

  for (const fmt of PARSE_FORMATS) {
    try {
      const d = parse(text, fmt, new Date());
      if (isValid(d)) return d;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function formatSheetDate(value: unknown): string {
  if (value == null) return "-";
  const parsed = value instanceof Date ? value : parseSheetDateValue(value);
  if (parsed && isValid(parsed)) return format(parsed, SHEET_DATE_FORMAT);
  const text = String(value).trim();
  return text || "-";
}

export function computeTatFromDateStrings(
  oppRaw: unknown,
  propRaw: unknown,
  holidays?: Set<string>
): {
  oppFormatted: string | null;
  propFormatted: string | null;
  tat: number;
  holidayCount: number;
} {
  const opp = parseSheetDateValue(oppRaw);
  const prop = parseSheetDateValue(propRaw);
  if (!opp || !prop) {
    return { oppFormatted: null, propFormatted: null, tat: 0, holidayCount: 0 };
  }
  const { tat, holidayCount } = computeTatFromDates(opp, prop, holidays);
  return {
    oppFormatted: format(opp, SHEET_DATE_FORMAT),
    propFormatted: format(prop, SHEET_DATE_FORMAT),
    tat,
    holidayCount,
  };
}

/** Parse Gemini YYYY-MM-DD (or fallback formats) into sheet dates + TAT. */
export function formatAiSheetDates(
  oppStr: unknown,
  propStr: unknown,
  holidays?: Set<string>
): { oppFormatted: string; propFormatted: string; tat: number; holidayCount: number } {
  const holidaySet = holidays ?? loadPublicHolidays();
  const nowFmt = format(new Date(), SHEET_DATE_FORMAT);
  const oppText = String(oppStr ?? "").trim();
  const propText = String(propStr ?? "").trim();

  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(oppText) && /^\d{4}-\d{2}-\d{2}$/.test(propText)) {
      const opp = parse(oppText, "yyyy-MM-dd", new Date());
      const prop = parse(propText, "yyyy-MM-dd", new Date());
      if (isValid(opp) && isValid(prop)) {
        const { tat, holidayCount } = computeTatFromDates(opp, prop, holidaySet);
        return {
          oppFormatted: format(opp, SHEET_DATE_FORMAT),
          propFormatted: format(prop, SHEET_DATE_FORMAT),
          tat,
          holidayCount,
        };
      }
    }
  } catch {
    /* fall through */
  }

  const fallback = computeTatFromDateStrings(oppStr, propStr, holidaySet);
  if (fallback.oppFormatted != null) {
    return {
      oppFormatted: fallback.oppFormatted,
      propFormatted: fallback.propFormatted!,
      tat: fallback.tat,
      holidayCount: fallback.holidayCount,
    };
  }

  return {
    oppFormatted: oppText ? formatSheetDate(oppText) : nowFmt,
    propFormatted: propText ? formatSheetDate(propText) : nowFmt,
    tat: 0,
    holidayCount: 0,
  };
}
