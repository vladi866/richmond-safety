# Richmond Elevator — Safety & Timesheet App

Mobile web app (PWA): ToolBox Meeting, Daily Hazard Assessment (JHA), and Timesheet.

## Run locally
```bash
cd richmond-safety-fixed
python3 -m http.server 8080
```
Open http://localhost:8080 — do **not** open index.html as a file:// URL.

## Deploy (GitHub Pages)
1. Create a repo, upload all files in this folder to the root.
2. Settings → Pages → Deploy from branch `main` / root.
3. On iPhone: Safari → Share → Add to Home Screen.

## Supabase
Uses project `https://fgfkqsbasgjpwpkqjoar.supabase.co` with the publishable key in `index.html`.

**You must enable RLS.** See the walkthrough from your assistant for exact SQL policies on `forms` and `lib`.

## Fixes in this build
- Original had syntax errors (duplicate `saveDraft`, broken ternary, missing brace in `sigR`, corrupted timesheet block) that prevented the app from loading on modern browsers.
- Timesheet restored from `timesheet_clean.js`.
- Delete queries include `owner=eq.${dev}`.
- Library inserts sanitized + length-limited.
- Forms payload strips receipt dataUrls before cloud upload.
- Service worker `safety-v9` with safer caching.
- Dead files and Claude dev artifacts removed.
