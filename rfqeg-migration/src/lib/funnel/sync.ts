/** Sales Funnel Bot orchestration (Expo run_bot / reapply / setup). */

import { FUNNEL_COLUMN_COUNT, FUNNEL_COLUMN_HEADERS, SHEET_URL } from "./constants";
import { formatAiSheetDates, computeTatFromDateStrings, formatSheetDate } from "./dates";
import { extractFunnelCircuits, funnelGeminiConfigured } from "./gemini";
import {
  fetchUnreadFunnelEmails,
  funnelEmailConfigured,
  funnelEmailUser,
  markFunnelEmailRead,
} from "./gmail";
import {
  formatCurrency,
  normalizeContractTerm,
  normalizeEndCustomer,
  normalizeLmInfra,
  normalizeOfferedUs,
  normalizeOnNetStatus,
  normalizePartnerName,
  normalizeProtectionStatus,
  normalizeXcStatus,
  resolveTechnology,
} from "./normalizers";
import { normalizeQuoteId } from "./quote-id";
import { quoteIdSortKey } from "./quote-id";
import {
  appendFunnelRows,
  ensureFunnelSheetColumns,
  funnelSheetsConfigured,
  getAllSheetValues,
  replaceAllFunnelRows,
  serviceAccountEmail,
} from "./sheets";
import { loadPublicHolidays } from "./tat";

export type FunnelStatus = {
  sheetsConfigured: boolean;
  emailConfigured: boolean;
  geminiConfigured: boolean;
  sheetUrl: string;
  serviceAccountEmail: string | null;
  emailUser: string;
};

export function getFunnelStatus(): FunnelStatus {
  return {
    sheetsConfigured: funnelSheetsConfigured(),
    emailConfigured: funnelEmailConfigured(),
    geminiConfigured: funnelGeminiConfigured(),
    sheetUrl: SHEET_URL,
    serviceAccountEmail: serviceAccountEmail(),
    emailUser: funnelEmailUser(),
  };
}

function cell(row: string[], idx: number, fallback = "-"): string {
  const v = row[idx];
  return v != null && String(v).trim() ? String(v).trim() : fallback;
}

function padRow(row: string[]): string[] {
  const copy = [...row];
  while (copy.length < FUNNEL_COLUMN_COUNT) copy.push("-");
  return copy;
}

export async function setupFunnelColumns(): Promise<{ changed: boolean; message: string }> {
  if (!funnelSheetsConfigured()) {
    throw new Error(
      "Google Sheets not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON (or PATH) and share the sheet with the service account."
    );
  }
  return ensureFunnelSheetColumns();
}

export async function reapplyFunnelRules(): Promise<{ message: string; rowCount: number }> {
  if (!funnelSheetsConfigured()) {
    throw new Error("Google Sheets not configured for Funnel Bot");
  }
  await ensureFunnelSheetColumns();
  const allValues = await getAllSheetValues();
  if (!allValues.length || allValues.length <= 1) {
    return { message: "Sheet contains no data rows to align.", rowCount: 0 };
  }

  const dataRows = allValues.slice(1).map(padRow);
  const publicHolidays = loadPublicHolidays();
  const alignedRows: unknown[][] = [];

  for (const row of dataRows) {
    const quoteId = cell(row, 1);
    const partnerName = normalizePartnerName(row[3]);
    const endCustomer = normalizeEndCustomer(row[4]);
    let siteA = cell(row, 5);
    let siteACity = cell(row, 6);
    let siteB = cell(row, 7);
    let siteBCity = cell(row, 8);
    const serviceRaw = cell(row, 10);
    const techNorm = resolveTechnology(serviceRaw, row[9]);
    const capacity = cell(row, 11);
    const commMode = cell(row, 14, "Email");
    const salesEffort = cell(row, 17);
    const comments = cell(row, 18);
    const status = cell(row, 19, "OPEN");
    const subStatus = cell(row, 20, "MEDIUM");
    const poc = cell(row, 21);
    const emailAddr = cell(row, 22);

    let xcStatus: string;
    if (techNorm === "Internet") {
      siteB = "-";
      siteBCity = "-";
      xcStatus = "-";
    } else {
      xcStatus = normalizeXcStatus(row[28]);
    }

    let oppFormatted: string;
    let propFormatted: string;
    let tat: number;
    let holidayCount: number;
    const tatResult = computeTatFromDateStrings(row[2], row[15], publicHolidays);
    if (tatResult.oppFormatted == null) {
      oppFormatted = formatSheetDate(row[2]);
      propFormatted = formatSheetDate(row[15]);
      tat = 0;
      holidayCount = 0;
    } else {
      oppFormatted = tatResult.oppFormatted;
      propFormatted = tatResult.propFormatted!;
      tat = tatResult.tat;
      holidayCount = tatResult.holidayCount;
    }

    alignedRows.push([
      null,
      quoteId,
      oppFormatted,
      partnerName,
      endCustomer,
      siteA,
      siteACity,
      siteB,
      siteBCity,
      techNorm,
      serviceRaw,
      capacity,
      formatCurrency(row[12]),
      formatCurrency(row[13]),
      commMode,
      propFormatted,
      normalizeContractTerm(row[16]),
      salesEffort,
      comments,
      status,
      subStatus,
      poc,
      emailAddr,
      tat,
      normalizeOnNetStatus(row[24]),
      normalizeLmInfra(row[25], comments),
      normalizeProtectionStatus(row[26], "Unprotected"),
      normalizeProtectionStatus(row[27], "N/A"),
      xcStatus,
      holidayCount,
      normalizeOfferedUs(row[30]),
    ]);
  }

  alignedRows.sort((a, b) => {
    const ka = quoteIdSortKey(a[1]);
    const kb = quoteIdSortKey(b[1]);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] < kb[i]) return -1;
      if (ka[i] > kb[i]) return 1;
    }
    return 0;
  });

  for (let i = 0; i < alignedRows.length; i++) {
    alignedRows[i][0] = i + 1;
  }

  await replaceAllFunnelRows([[...FUNNEL_COLUMN_HEADERS], ...alignedRows]);
  return {
    message: `Success! Reapplied all automation rules (Pakistan holiday-aware TAT) and bunched Quote IDs in ascending order across all ${alignedRows.length} live funnel lines!`,
    rowCount: alignedRows.length,
  };
}

export async function runFunnelSync(): Promise<{
  message: string;
  rowsAdded: number;
  emailsScanned: number;
}> {
  if (!funnelSheetsConfigured()) {
    throw new Error(
      "Google Sheets not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON (or PATH) and share the sheet."
    );
  }
  if (!funnelEmailConfigured()) {
    throw new Error("Email not configured (set IMAP_* or GMAIL_* env vars)");
  }
  if (!funnelGeminiConfigured()) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  await ensureFunnelSheetColumns();
  const existing = await getAllSheetValues();
  const dataRowCount = Math.max(0, existing.length - (existing.length ? 1 : 0));
  let lastSNo = dataRowCount + 1;

  const emails = await fetchUnreadFunnelEmails();
  if (!emails.length) {
    return {
      message: "No new (unread) emails found. Mark a quote email as Unread to test.",
      rowsAdded: 0,
      emailsScanned: 0,
    };
  }

  const emailUser = funnelEmailUser();
  const publicHolidays = loadPublicHolidays();
  const newRows: unknown[][] = [];

  for (const mail of emails) {
    const body = mail.body || "";
    const forcedQuoteId = normalizeQuoteId(null, body);

    try {
      const aiData = await extractFunnelCircuits(body, emailUser);
      let circuits = aiData.circuits || [];
      if (!Array.isArray(circuits) && circuits && typeof circuits === "object") {
        circuits = [circuits as (typeof circuits)[number]];
      }

      for (const c of circuits) {
        const { oppFormatted, propFormatted, tat, holidayCount } = formatAiSheetDates(
          c["Opportunity Date"] || "",
          c["Proposal Date"] || "",
          publicHolidays
        );

        const serviceRaw = c["Service/Product"] || "-";
        const techNorm = resolveTechnology(serviceRaw, c.Technology || "-");
        const lmInfra = normalizeLmInfra(c["LM Infra Details"], c.Comments);
        const partnerName = normalizePartnerName(c["Partner Name"], mail.from);
        const endCustomer = normalizeEndCustomer(c["End Customer"]);
        const onNet = normalizeOnNetStatus(c["On-Net/Off-Net"]);
        const contractTerm = normalizeContractTerm(c["Contract Terms"]);
        const lastMileProtection = normalizeProtectionStatus(
          c["Last Mile Protection"],
          "Unprotected"
        );
        const wetSegmentProtection = normalizeProtectionStatus(
          c["Wet Segment Protection"],
          "N/A"
        );

        let siteA = c["Site A"] || "-";
        let siteACity = c["Site A City"] || "-";
        let siteB: string;
        let siteBCity: string;
        let xcStatus: string;
        if (techNorm === "Internet") {
          siteB = "-";
          siteBCity = "-";
          xcStatus = "-";
        } else {
          siteB = c["Site B"] || "-";
          siteBCity = c["Site B City"] || "-";
          xcStatus = normalizeXcStatus(c["XC Included/Excluded"]);
        }

        const offeredUs = normalizeOfferedUs(c["Offered Us"]);
        const quoteId =
          forcedQuoteId !== "-"
            ? forcedQuoteId
            : normalizeQuoteId(c["Quote ID"] || "-", body);

        newRows.push([
          lastSNo,
          quoteId,
          oppFormatted,
          partnerName,
          endCustomer,
          siteA,
          siteACity,
          siteB,
          siteBCity,
          techNorm,
          serviceRaw,
          c["Capacity / Quantity"] || "-",
          formatCurrency(c.NRC),
          formatCurrency(c.MRC),
          "Email",
          propFormatted,
          contractTerm,
          c["Sales Effort By"] || "-",
          c.Comments || "-",
          "OPEN",
          "MEDIUM",
          c.POC || "-",
          c["Contact Email Address"] || "-",
          tat,
          onNet,
          lmInfra,
          lastMileProtection,
          wetSegmentProtection,
          xcStatus,
          holidayCount,
          offeredUs,
        ]);
        lastSNo += 1;
      }
    } catch (err) {
      // Mark read anyway to avoid hot-looping on a poison email; surface error after.
      await markFunnelEmailRead(mail.id).catch(() => {});
      throw err;
    }

    await markFunnelEmailRead(mail.id).catch(() => {});
  }

  if (newRows.length) {
    await appendFunnelRows(newRows);
    return {
      message: `Success! Added ${newRows.length} perfectly structured rows to the Google Sheet!`,
      rowsAdded: newRows.length,
      emailsScanned: emails.length,
    };
  }

  return {
    message: "Unread emails processed, but no valid data structures were detected by Gemini.",
    rowsAdded: 0,
    emailsScanned: emails.length,
  };
}
