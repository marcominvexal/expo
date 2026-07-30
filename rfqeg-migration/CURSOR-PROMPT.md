# Paste this into Cursor while your RFQEG repo is open

---

**Task:** Add the full **Sales Funnel Bot** (Expo Streamlit bot) as a **self-contained Sales-only module** in RFQEG. I have a handoff package at `./rfqeg-migration/` (or I will paste files from Expo PR #3 `rfqeg-migration/`).

**Do not** change RFQ “Update From Email” — funnel is separate.

### Copy / implement these paths

```
src/lib/funnel/
  constants.ts, quote-id.ts, normalizers.ts, tat.ts, dates.ts,
  gemini.ts, gmail.ts, sheets.ts, sync.ts, index.ts, holidays.json
  __tests__/funnel.test.ts

src/app/api/funnel/
  status/route.ts      GET
  sync/route.ts        POST maxDuration 120
  setup-columns/route.ts POST
  reapply/route.ts     POST maxDuration 120

src/app/(app)/funnel/page.tsx
src/features/funnel/funnel-dashboard.tsx
src/features/funnel/rules-panel.tsx
```

Update `src/components/app-shell.tsx`: add `{ href: "/funnel", label: "Funnel", icon: Sheet, salesOnly: true }`.

Update `.env.example` with FUNNEL_* and GOOGLE_SERVICE_ACCOUNT_* vars.

### Credentials (from handoff `local-only/`)

1. Copy `local-only/rfqeg.env` → `.env`
2. Copy `local-only/service_account.json` → repo root (gitignore it)
3. Share Google Sheet `1E9gYdeZUwMEmnwe164io7E47QuXnBfYcELdulUroN_4` with SA email in `SERVICE_ACCOUNT_EMAIL.txt`
4. Gmail: copy inbox credentials from `local-only/expo-secrets.env` into IMAP vars in `.env`
5. Replace `GEMINI_API_KEY` with a working Google AI Studio key if sync 401s

### Behavior (must match Expo)

- Sync: all **UNSEEN** inbox emails → Gemini circuits JSON → 31-column sheet append
- Quote ID: **body only** `I###-##` / `F###-##`; ignore subject QTE refs
- TAT: Pakistan holidays + weekends between Opportunity & Proposal dates
- Reapply: re-normalize all rows, sort Quote ID, renumber S.NO
- Auth: `requireUser(req, "SALES")` on all `/api/funnel/*`

### Verify

```bash
npm install && npm run typecheck && npm test src/lib/funnel
npm run dev
# Login sales@invexal.com / sales123 → /funnel → Reapply rules & sort
```

Read full spec: `rfqeg-migration/HANDOFF.md`
