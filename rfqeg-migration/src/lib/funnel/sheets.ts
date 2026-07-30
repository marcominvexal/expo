/** Google Sheets access for the Sales Funnel Bot (service account). */

import { google, sheets_v4 } from "googleapis";
import fs from "fs";
import path from "path";
import {
  DEFAULT_SPREADSHEET_ID,
  FUNNEL_COLUMN_COUNT,
  FUNNEL_COLUMN_HEADERS,
  FUNNEL_SCOPES,
  FUNNEL_WORKSHEET_GID,
  MEDIA_FIBER,
  MEDIA_WIRELESS,
  SHEET_DATE_COLUMN_INDICES,
} from "./constants";
import { colIndexToLetter, formatSheetDate, parseSheetDateValue } from "./dates";

type SaInfo = Record<string, string>;

function normalizeServiceAccountInfo(info: SaInfo | null): SaInfo | null {
  if (!info) return null;
  const data = { ...info };
  if (typeof data.private_key === "string" && data.private_key.includes("\\n")) {
    data.private_key = data.private_key.replace(/\\n/g, "\n");
  }
  if (!data.client_email || !data.private_key) return null;
  return data;
}

function loadServiceAccountInfo(): SaInfo | null {
  const jsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.FUNNEL_SERVICE_ACCOUNT_JSON;
  if (jsonEnv?.trim()) {
    try {
      return normalizeServiceAccountInfo(JSON.parse(jsonEnv) as SaInfo);
    } catch {
      /* fall through */
    }
  }

  const filePath =
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH ||
    process.env.FUNNEL_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (filePath) {
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    if (fs.existsSync(resolved)) {
      try {
        return normalizeServiceAccountInfo(JSON.parse(fs.readFileSync(resolved, "utf8")) as SaInfo);
      } catch {
        /* fall through */
      }
    }
  }

  // Nested env vars (GCP_SERVICE_ACCOUNT_*)
  const prefix = "GCP_SERVICE_ACCOUNT_";
  const fieldMap: Record<string, string> = {
    TYPE: "type",
    PROJECT_ID: "project_id",
    PRIVATE_KEY_ID: "private_key_id",
    PRIVATE_KEY: "private_key",
    CLIENT_EMAIL: "client_email",
    CLIENT_ID: "client_id",
    AUTH_URI: "auth_uri",
    TOKEN_URI: "token_uri",
    AUTH_PROVIDER_X509_CERT_URL: "auth_provider_x509_cert_url",
    CLIENT_X509_CERT_URL: "client_x509_cert_url",
    UNIVERSE_DOMAIN: "universe_domain",
  };
  const built: SaInfo = {};
  for (const [suffix, key] of Object.entries(fieldMap)) {
    const v = process.env[`${prefix}${suffix}`];
    if (v) built[key] = v;
  }
  if (built.client_email && built.private_key) {
    return normalizeServiceAccountInfo(built);
  }
  return null;
}

export function funnelSheetsConfigured(): boolean {
  return !!loadServiceAccountInfo();
}

export function funnelSpreadsheetId(): string {
  return process.env.FUNNEL_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
}

async function sheetsClient(): Promise<sheets_v4.Sheets> {
  const info = loadServiceAccountInfo();
  if (!info) throw new Error("Google service account not configured for Funnel Sheets");
  const auth = new google.auth.GoogleAuth({
    credentials: info,
    scopes: [...FUNNEL_SCOPES],
  });
  return google.sheets({ version: "v4", auth });
}

async function resolveSheetTitle(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<string> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const gid = FUNNEL_WORKSHEET_GID;
  const match = meta.data.sheets?.find((s) => s.properties?.sheetId === gid);
  if (match?.properties?.title) return match.properties.title;
  const first = meta.data.sheets?.[0]?.properties?.title;
  if (!first) throw new Error("Spreadsheet has no worksheets");
  return first;
}

function normalizeSheetHeader(text: unknown): string {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ \/ /g, "/")
    .replace(/\/ /g, "/")
    .replace(/ \//g, "/");
}

export async function getAllSheetValues(): Promise<string[][]> {
  const sheets = await sheetsClient();
  const spreadsheetId = funnelSpreadsheetId();
  const title = await resolveSheetTitle(sheets, spreadsheetId);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${title}'`,
  });
  return (res.data.values as string[][]) || [];
}

export async function ensureFunnelSheetColumns(): Promise<{ changed: boolean; message: string }> {
  const sheets = await sheetsClient();
  const spreadsheetId = funnelSpreadsheetId();
  const title = await resolveSheetTitle(sheets, spreadsheetId);
  const allValues = await getAllSheetValues();
  const currentHeaders = allValues[0] || [];
  const currentNormalized = currentHeaders
    .slice(0, FUNNEL_COLUMN_COUNT)
    .map(normalizeSheetHeader);
  const requiredNormalized = FUNNEL_COLUMN_HEADERS.map(normalizeSheetHeader);
  const headersMatch =
    currentHeaders.length >= FUNNEL_COLUMN_COUNT &&
    currentNormalized.length === requiredNormalized.length &&
    currentNormalized.every((h, i) => h === requiredNormalized[i]);

  if (headersMatch) {
    return { changed: false, message: "Funnel column headers already match the 31-column layout." };
  }

  const lastCol = colIndexToLetter(FUNNEL_COLUMN_COUNT - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1:${lastCol}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[...FUNNEL_COLUMN_HEADERS]] },
  });

  if (!allValues.length) {
    return { changed: true, message: `Created ${FUNNEL_COLUMN_COUNT} funnel column headers on an empty sheet.` };
  }
  return { changed: true, message: `Updated row 1 to the ${FUNNEL_COLUMN_COUNT}-column funnel layout.` };
}

export async function appendFunnelRows(rows: unknown[][]): Promise<void> {
  if (!rows.length) return;
  const sheets = await sheetsClient();
  const spreadsheetId = funnelSpreadsheetId();
  const title = await resolveSheetTitle(sheets, spreadsheetId);
  const existing = await getAllSheetValues();
  const firstRow = existing.length + 1; // 1-based; if header-only, append at row 2
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${title}'!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows.map((r) => r.map((c) => (c == null ? "" : c))) },
  });

  const lastRow = firstRow + rows.length - 1;
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetId =
      meta.data.sheets?.find((s) => s.properties?.title === title)?.properties?.sheetId ??
      FUNNEL_WORKSHEET_GID;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: sheetId ?? 0,
                startRowIndex: firstRow - 1,
                endRowIndex: lastRow,
                startColumnIndex: 12,
                endColumnIndex: 14,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: { type: "CURRENCY", pattern: "$#,##0.00" },
                },
              },
              fields: "userEnteredFormat.numberFormat",
            },
          },
        ],
      },
    });
  } catch {
    /* formatting is best-effort */
  }
  void MEDIA_FIBER;
  void MEDIA_WIRELESS;
}

export async function replaceAllFunnelRows(headerPlusRows: unknown[][]): Promise<void> {
  const sheets = await sheetsClient();
  const spreadsheetId = funnelSpreadsheetId();
  const title = await resolveSheetTitle(sheets, spreadsheetId);
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${title}'`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: headerPlusRows.map((r) => r.map((c) => (c == null ? "" : c))),
    },
  });

  if (headerPlusRows.length > 1) {
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetId =
        meta.data.sheets?.find((s) => s.properties?.title === title)?.properties?.sheetId ??
        FUNNEL_WORKSHEET_GID;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: sheetId ?? 0,
                  startRowIndex: 1,
                  endRowIndex: headerPlusRows.length,
                  startColumnIndex: 12,
                  endColumnIndex: 14,
                },
                cell: {
                  userEnteredFormat: {
                    numberFormat: { type: "CURRENCY", pattern: "$#,##0.00" },
                  },
                },
                fields: "userEnteredFormat.numberFormat",
              },
            },
          ],
        },
      });
    } catch {
      /* best-effort */
    }
  }
}

export async function reformatExistingSheetDates(): Promise<string> {
  const sheets = await sheetsClient();
  const spreadsheetId = funnelSpreadsheetId();
  const title = await resolveSheetTitle(sheets, spreadsheetId);
  const allValues = await getAllSheetValues();
  if (!allValues.length) return "Sheet is empty — nothing to update.";

  const data: { range: string; values: string[][] }[] = [];
  let updatedCells = 0;
  const rowNums = new Set<number>();

  for (let rowIdx = 1; rowIdx < allValues.length; rowIdx++) {
    const row = allValues[rowIdx];
    const rowNum = rowIdx + 1;
    for (const colIdx of SHEET_DATE_COLUMN_INDICES) {
      if (colIdx >= row.length) continue;
      const raw = row[colIdx];
      const parsed = parseSheetDateValue(raw);
      if (!parsed) continue;
      const formatted = formatSheetDate(parsed);
      if (String(raw).trim() === formatted) continue;
      const colLetter = colIndexToLetter(colIdx);
      data.push({ range: `'${title}'!${colLetter}${rowNum}`, values: [[formatted]] });
      updatedCells += 1;
      rowNums.add(rowNum);
    }
  }

  if (!data.length) {
    return "All dates already use dd-Month-yyyy (e.g. 19-May-2026).";
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });

  return `Updated ${updatedCells} date cell(s) across ${rowNums.size} row(s) to dd-Month-yyyy (e.g. 19-May-2026).`;
}

export function serviceAccountEmail(): string | null {
  return loadServiceAccountInfo()?.client_email ?? null;
}
