# RFQ Portal (RFQEG)

Enterprise telecom RFQ management portal (Next.js). See README for standard setup.

## Cursor Cloud specific instructions

### Sales Funnel Bot (contained Expo module)

- **Route:** `/funnel` (Sales-only nav item). **Not** the same as RFQs → “Update From Email” (that imports Solution Request RFQs into the portal DB).
- **APIs (Sales JWT required):** `GET /api/funnel/status`, `POST /api/funnel/sync`, `POST /api/funnel/setup-columns`, `POST /api/funnel/reapply`.
- **Logic lives in** `src/lib/funnel/*` — keep it self-contained; do not mix with `src/lib/gemini.ts` RFQ extractors or `update-from-email`.
- **Credentials:** reuses `GEMINI_API_KEY`, `IMAP_*` (or Gmail OAuth). Sheets needs a **service account** via `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_SERVICE_ACCOUNT_PATH` (see `.env.example`). Share the spreadsheet with the SA `client_email`.
- **Sync behavior:** processes **all UNSEEN** inbox mail (Expo-style), not only “Solution Request”. Quote IDs are body-only `I###-##` / `F###-##`.
- **TAT:** Pakistan holiday-aware working days between Opportunity and Proposal (`src/lib/funnel/holidays.json` + `tat.ts`).
- Sync/reapply can take up to ~60s on Gemini 503/429 retries (`maxDuration` 120 on those routes).

### Standard commands

Use `npm run dev`, `npm run lint`, `npm run typecheck`, `npm test` as documented in `package.json` / README.
