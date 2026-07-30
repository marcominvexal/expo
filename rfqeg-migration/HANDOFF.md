# Sales Funnel Bot → RFQEG — complete handoff

Use this folder to rebuild the module **inside your local RFQEG clone** with Cursor.  
**Do not merge this tree into Expo `main`.** Copy files into RFQEG only.

---

## 1. Cursor prompt (paste into RFQEG repo chat)

```
Implement the Sales Funnel Bot as a self-contained Sales-only module in this RFQEG repo.

Reference implementation: copy everything from the Expo handoff package `rfqeg-migration/` (or this folder if I attached it):

BACKEND (src/lib/funnel/*):
- constants.ts — 31 column headers, spreadsheet ID, Exponentia domains
- quote-id.ts — body-only I###-## / F###-## (never subject/QTE refs)
- normalizers.ts — currency, LM infra, partner, tech taxonomy, protection, XC
- tat.ts + holidays.json — Pakistan holiday-aware TAT between Opportunity & Proposal dates
- dates.ts — sheet date format dd-MMMM-yyyy
- gemini.ts — Expo 16-rule prompt + circuits JSON schema + 60s retry on 503/429
- gmail.ts — fetch ALL UNSEEN IMAP (or Gmail OAuth), NOT "Solution Request" filter
- sheets.ts — googleapis service account (Sheets + Drive scopes)
- sync.ts — runFunnelSync, reapplyFunnelRules, setupFunnelColumns, getFunnelStatus

API routes (Sales JWT only — requireUser(req, "SALES")):
- GET  /api/funnel/status
- POST /api/funnel/sync          (maxDuration 120)
- POST /api/funnel/setup-columns
- POST /api/funnel/reapply       (maxDuration 120)

UI (Sales only):
- src/app/(app)/funnel/page.tsx
- src/features/funnel/funnel-dashboard.tsx — status, Sync / Setup columns / Reapply buttons
- src/features/funnel/rules-panel.tsx — column rules from Expo
- app-shell.tsx — add nav { href: "/funnel", label: "Funnel", icon: Sheet, salesOnly: true }

Keep separate from existing RFQ "Update From Email" (/api/update-from-email) which imports Solution Requests into the DB.

Env (.env): see local-only/rfqeg.env — GEMINI_API_KEY, IMAP_*, FUNNEL_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_PATH + service_account.json. Share the Google Sheet with the service account email in SERVICE_ACCOUNT_EMAIL.txt.

Verify: npm run typecheck, npm test src/lib/funnel, login as sales@invexal.com, open /funnel, run Reapply rules.
```

---

## 2. File map (copy into RFQEG)

| Source (this package) | Destination in RFQEG |
|----------------------|----------------------|
| `src/lib/funnel/**` | `src/lib/funnel/**` |
| `src/features/funnel/**` | `src/features/funnel/**` |
| `src/app/(app)/funnel/**` | `src/app/(app)/funnel/**` |
| `src/app/api/funnel/**` | `src/app/api/funnel/**` |
| `overlays/app-shell.tsx` | merge Funnel nav into `src/components/app-shell.tsx` |
| `overlays/env.example` | merge funnel vars into `.env.example` |
| `overlays/AGENTS.md` | merge funnel section into `AGENTS.md` |
| `overlays/gitignore` | add `service_account.json` to `.gitignore` |
| `local-only/rfqeg.env` | → RFQEG `.env` (never commit) |
| `local-only/service_account.json` | → RFQEG root `service_account.json` |

One-shot apply from RFQEG root:

```bash
git apply path/to/rfqeg-migration/rfqeg-sales-funnel-module.patch
cp local-only/rfqeg.env .env
cp local-only/service_account.json .
npm install && npm run typecheck && npm test src/lib/funnel
```

---

## 3. Credentials & integrations

### Google Sheet (funnel output)

| Setting | Value |
|---------|--------|
| Spreadsheet ID | `1E9gYdeZUwMEmnwe164io7E47QuXnBfYcELdulUroN_4` |
| Worksheet GID | `0` (first tab) |
| URL | https://docs.google.com/spreadsheets/d/1E9gYdeZUwMEmnwe164io7E47QuXnBfYcELdulUroN_4/edit#gid=0 |
| Columns | 31 (see `constants.ts` FUNNEL_COLUMN_HEADERS) |

**Sheet access:** Editor share for the email address in `local-only/SERVICE_ACCOUNT_EMAIL.txt`.

### Gmail (inbox — unread quotes)

| Setting | Value |
|---------|--------|
| Account / app password | `local-only/expo-secrets.env` (first two credential lines) |
| IMAP | `imap.gmail.com:993` SSL |
| Env in RFQEG | Map inbox login → `IMAP_USER`, app password → `IMAP_PASSWORD` |

Funnel sync reads **every UNSEEN** message in INBOX (Expo behavior). RFQ “Update From Email” still filters “Solution Request” only.

### Gemini (extraction)

| Setting | Value |
|---------|--------|
| Env | `GEMINI_API_KEY`, optional `FUNNEL_GEMINI_MODEL` / `GEMINI_MODEL` |
| Default model | `gemini-2.5-flash` (Expo used `gemini-2.5-flash` in Streamlit) |
| Output | JSON `{ circuits: [...] }` with 16 alignment rules |

**Important:** The key stored in Expo (`AQ.Ab8…`, 53 chars) currently returns **401** from `generativelanguage.googleapis.com`. For sync to work, create a **Google AI Studio API key** at https://aistudio.google.com/apikey and replace `GEMINI_API_KEY` in `.env`.

### Google service account (Sheets API)

| Setting | Value |
|---------|--------|
| File | `local-only/service_account.json` (full JSON — copy to RFQEG root) |
| Project | `exponentia-project` |
| Scopes | `spreadsheets`, `drive` |
| Alt env | `GOOGLE_SERVICE_ACCOUNT_JSON` (inline JSON string) or `GOOGLE_SERVICE_ACCOUNT_PATH=service_account.json` |

---

## 4. API reference

All routes use `requireUser(req, "SALES")` — Presales gets 403.

### `GET /api/funnel/status`

```json
{
  "sheetsConfigured": true,
  "emailConfigured": true,
  "geminiConfigured": true,
  "sheetUrl": "https://docs.google.com/spreadsheets/...",
  "serviceAccountEmail": "<see SERVICE_ACCOUNT_EMAIL.txt>",
  "emailUser": "<see expo-secrets.env>"
}
```

### `POST /api/funnel/sync`

1. Open funnel worksheet, ensure 31 headers  
2. Fetch all UNSEEN IMAP/Gmail messages  
3. Per email: body-only Quote ID → Gemini circuits → normalize → append rows  
4. Mark each email read  
5. Returns `{ message, rowsAdded, emailsScanned }`

### `POST /api/funnel/setup-columns`

Ensures row 1 matches `FUNNEL_COLUMN_HEADERS`.

### `POST /api/funnel/reapply`

Re-normalizes all data rows, recomputes TAT/holidays, sorts by Quote ID, renumbers S.NO.  
Verified locally: **897 rows** on live sheet.

---

## 5. Auth & test login (RFQEG portal)

After `npm run db:seed`:

| Role | Email | Password |
|------|-------|----------|
| Sales (Funnel access) | `sales@invexal.com` | `sales123` |
| Presales (blocked) | `presales@invexal.com` | `presales123` |

Funnel UI: http://localhost:3000/funnel

---

## 6. Expo source of truth (Streamlit)

Original bot: `/workspace/streamlit_app.py` in **marcominvexal/Expo** repo.

Key functions ported: `run_bot`, `reapply_all_rules_and_align_sheet`, `get_ai_extraction`, `normalize_quote_id`, `format_ai_sheet_dates`, `load_public_holidays`.

---

## 7. What is NOT the funnel bot

| Feature | Path | Purpose |
|---------|------|---------|
| RFQ email import | `/api/update-from-email` | Solution Request → RFQ DB |
| RFQ Gemini | `src/lib/gemini.ts` | `extractRfqFromEmail` |
| RFQ IMAP filter | `src/lib/email-imap.ts` | "Solution Request" only |

Do not merge funnel logic into those files.

---

## 8. Local-only secrets (this package)

```
local-only/
  expo-secrets.env      # Gemini + Gmail inbox credentials (Expo Streamlit)
  rfqeg.env             # Ready-to-copy RFQEG .env
  service_account.json  # Google Sheets SA private key
  SERVICE_ACCOUNT_EMAIL.txt
```

**Never commit `local-only/` or `.env`.**

---

## 9. npm scripts

```bash
npm run dev          # :3000
npm run typecheck
npm run lint
npm test src/lib/funnel
```

Dependencies already in RFQEG: `googleapis`, `@google/generative-ai`, `imapflow`, `mailparser`, `date-fns`.

---

## 10. Repo locations

| Repo | Path | Branch (if applicable) |
|------|------|------------------------|
| Expo handoff package | `Expo/rfqeg-migration/` | `cursor/rfqeg-funnel-migration-package-e4ce` (PR #3) |
| RFQEG local clone (agent) | `/home/ubuntu/RFQEG` | `cursor/sales-funnel-module-e4ce` commit `95872fe` |

Copy `rfqeg-migration/` into your machine’s RFQEG folder and use **§1 Cursor prompt** to regenerate or apply the patch.
