/**
 * Pakistan holiday-aware TAT (ported from Expo).
 * TAT = business days between Opportunity and Proposal (inclusive span minus 1),
 * excluding Sat/Sun and Pakistan public holidays.
 */

import holidaysData from "./holidays.json";

type HolidayEntry = { date: string; name: string };
type HolidaysFile = {
  dates?: string[];
  holidays?: HolidayEntry[];
};

function loadHolidaySet(): Set<string> {
  const data = holidaysData as HolidaysFile;
  const set = new Set<string>();
  for (const item of data.dates ?? []) {
    const text = String(item).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) set.add(text);
  }
  for (const entry of data.holidays ?? []) {
    const text = String(entry?.date ?? "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) set.add(text);
  }
  return set;
}

let cachedHolidays: Set<string> | null = null;

export function loadPublicHolidays(): Set<string> {
  if (!cachedHolidays) cachedHolidays = loadHolidaySet();
  return cachedHolidays;
}

export function holidayName(ymd: string): string | undefined {
  const data = holidaysData as HolidaysFile;
  return data.holidays?.find((h) => h.date === ymd)?.name;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Count Pakistan public holidays on weekdays within [start, end] inclusive. */
export function countHolidaysInRange(
  startDate: Date,
  endDate: Date,
  holidays?: Set<string>
): number {
  const holidaySet = holidays ?? loadPublicHolidays();
  if (!holidaySet.size) return 0;
  let current = startOfDay(startDate);
  const end = startOfDay(endDate);
  let count = 0;
  while (current.getTime() <= end.getTime()) {
    const key = ymd(current);
    if (holidaySet.has(key) && current.getDay() !== 0 && current.getDay() !== 6) {
      count += 1;
    }
    current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
  }
  return count;
}

/**
 * Business days in [start, end] inclusive, minus 1 (exclusive TAT),
 * excluding weekends and Pakistan holidays.
 */
export function calculateWorkingDaysExclusive(
  startDate: Date,
  endDate: Date,
  holidays?: Set<string>
): number {
  if (startDate.getTime() >= endDate.getTime()) return 0;
  const holidaySet = holidays ?? loadPublicHolidays();
  let current = startOfDay(startDate);
  const end = startOfDay(endDate);
  let workingDays = 0;
  while (current.getTime() <= end.getTime()) {
    const key = ymd(current);
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6 && !holidaySet.has(key)) {
      workingDays += 1;
    }
    current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
  }
  return Math.max(0, workingDays - 1);
}

export function computeTatFromDates(
  startDate: Date,
  endDate: Date,
  holidays?: Set<string>
): { tat: number; holidayCount: number } {
  const holidaySet = holidays ?? loadPublicHolidays();
  return {
    tat: calculateWorkingDaysExclusive(startDate, endDate, holidaySet),
    holidayCount: countHolidaysInRange(startDate, endDate, holidaySet),
  };
}
