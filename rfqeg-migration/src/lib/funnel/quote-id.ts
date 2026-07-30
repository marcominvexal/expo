/** Quote ID: body-only I###-## / F###-## (never subject / partner refs). */

const EXPONENTIA_QUOTE_ID_RE = /\b([IF])\s*0*(\d{1,5})\s*-\s*0*(\d{2})\b/gi;
const EMAIL_THREAD_SPLIT_RE =
  /^(?:From:\s|Sent:\s|-----+ ?Original Message ?-----+|Begin forwarded message:)/im;
const EXPLICIT_QUOTE_ID_LABEL_RE =
  /\bQuote\s*ID\s*[:\-–]?\s*([IF]\s*0*\d{1,5}\s*-\s*0*\d{2})\b/gi;
const ADD_ARCHIVE_VARIANT_RE =
  /\b(?:pls\s+)?(?:add|update(?:d)?)\s*(?:&|and)\s*archive\b/gis;

function formatQuoteId(prefix: string, number: string, year: string): string {
  return `${prefix.toUpperCase()}${parseInt(number, 10)}-${year.padStart(2, "0")}`;
}

export function isValidExponentiaQuoteId(value: unknown): boolean {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return false;
  return /^([IF])\s*0*(\d{1,5})\s*-\s*0*(\d{2})$/i.test(text);
}

function emailMessageTip(text: string): string {
  if (!text) return "";
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const match = EMAIL_THREAD_SPLIT_RE.exec(normalized);
  if (match && match.index > 20) return normalized.slice(0, match.index);
  return normalized.slice(0, 2500);
}

function parseQuoteIdToken(raw: string): string | null {
  EXPONENTIA_QUOTE_ID_RE.lastIndex = 0;
  const parsed = EXPONENTIA_QUOTE_ID_RE.exec(raw);
  if (!parsed) return null;
  return formatQuoteId(parsed[1], parsed[2], parsed[3]);
}

export function findExponentiaQuoteIdsInText(text: string | null | undefined): string[] {
  if (!text) return [];
  const tip = emailMessageTip(text);
  const ordered: string[] = [];
  const push = (c: string | null) => {
    if (c && !ordered.includes(c)) ordered.push(c);
  };

  EXPLICIT_QUOTE_ID_LABEL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EXPLICIT_QUOTE_ID_LABEL_RE.exec(tip))) {
    push(parseQuoteIdToken(m[1]));
  }

  ADD_ARCHIVE_VARIANT_RE.lastIndex = 0;
  while ((m = ADD_ARCHIVE_VARIANT_RE.exec(tip))) {
    const windowStart = Math.max(0, m.index - 80);
    const windowEnd = Math.min(tip.length, m.index + m[0].length + 80);
    const before = tip.slice(windowStart, m.index);
    const window = tip.slice(windowStart, windowEnd);
    for (const chunk of [before, window]) {
      EXPONENTIA_QUOTE_ID_RE.lastIndex = 0;
      let qm: RegExpExecArray | null;
      while ((qm = EXPONENTIA_QUOTE_ID_RE.exec(chunk))) {
        push(formatQuoteId(qm[1], qm[2], qm[3]));
      }
    }
  }

  const tipHead = tip
    .split("\n")
    .map((ln) => ln.trim())
    .filter(Boolean)
    .slice(0, 12)
    .join("\n");
  EXPONENTIA_QUOTE_ID_RE.lastIndex = 0;
  while ((m = EXPONENTIA_QUOTE_ID_RE.exec(tipHead))) {
    push(formatQuoteId(m[1], m[2], m[3]));
  }

  if (ordered.length) return ordered;

  EXPONENTIA_QUOTE_ID_RE.lastIndex = 0;
  while ((m = EXPONENTIA_QUOTE_ID_RE.exec(text))) {
    push(formatQuoteId(m[1], m[2], m[3]));
  }
  return ordered;
}

export function normalizeQuoteId(
  value: unknown,
  emailBody?: string | null
): string {
  const recovered = findExponentiaQuoteIdsInText(emailBody);
  if (recovered.length) return recovered[0];

  const text = String(value ?? "").trim();
  if (isValidExponentiaQuoteId(text)) {
    const match = text.match(/^([IF])\s*0*(\d{1,5})\s*-\s*0*(\d{2})$/i)!;
    return formatQuoteId(match[1], match[2], match[3]);
  }
  return "-";
}

/** Natural sort key for I698-26 / F780-23 style IDs. */
export function quoteIdSortKey(quoteId: unknown): [number, number, string, number, string] {
  const text = String(quoteId ?? "").trim().toUpperCase();
  const match = text.match(/^([A-Z]+)\s*0*([0-9]+)\s*-\s*0*([0-9]+)$/);
  if (match) {
    return [0, parseInt(match[3], 10), match[1], parseInt(match[2], 10), text];
  }
  return [1, 0, "", 0, text];
}
