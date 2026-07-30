# Apply Sales Funnel Bot to RFQEG

This package is the full Expo → RFQEG Sales Funnel Bot migration.
Cursor Cloud can push to **Expo** only; **RFQEG** is not in the Cursor GitHub App
installation yet, so this delivery branch lives here until you grant RFQEG write access.

## Option A — grant write access (preferred)

1. GitHub → Settings → Applications → **Installed GitHub Apps** → **Cursor**
   (or https://github.com/settings/installations )
2. Configure → Repository access → select **Only select repositories**
3. Add **`marcominvexal/RFQEG`** (keep Expo selected too)
4. Save → tell the agent to push `cursor/sales-funnel-module-e4ce` on RFQEG

Local RFQEG commit already prepared: `95872fe` on branch `cursor/sales-funnel-module-e4ce`.

## Option B — apply this package manually

From a clone of `marcominvexal/RFQEG` on `main`:

```bash
git checkout -b cursor/sales-funnel-module-e4ce
# From this Expo repo path:
git apply --directory=. path/to/Expo/rfqeg-migration/rfqeg-sales-funnel-module.patch
# Or copy trees:
cp -R path/to/Expo/rfqeg-migration/src/lib/funnel src/lib/
cp -R path/to/Expo/rfqeg-migration/src/features/funnel src/features/
mkdir -p "src/app/(app)/funnel" src/app/api/funnel
cp -R path/to/Expo/rfqeg-migration/src/app/\(app\)/funnel/. "src/app/(app)/funnel/"
cp -R path/to/Expo/rfqeg-migration/src/app/api/funnel/. src/app/api/funnel/
# Merge overlays: app-shell Funnel nav, .env.example funnel vars, AGENTS.md, gitignore SA entry
```

Env (see overlays/env.example):
- `GOOGLE_SERVICE_ACCOUNT_PATH` or `GOOGLE_SERVICE_ACCOUNT_JSON`
- `FUNNEL_SPREADSHEET_ID` (optional; defaults to Expo sheet)
- Reuse `GEMINI_API_KEY`, `IMAP_*`

## What it adds

- Sales-only `/funnel` page + nav item
- `/api/funnel/{status,sync,setup-columns,reapply}`
- Contained `src/lib/funnel/*` (Gmail UNSEEN → Gemini → Sheets 31 cols)
