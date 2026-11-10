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


## Premium UI layer ("The Cab")

The look and motion now live in two files that load after `index.html`:

- `lux.css`: the single design system (lacquered navy, brushed steel, brass; serif display type).
  It replaces the old `lux-forms` block, which fought with the other two style layers.
- `lux.js`: the motion layer. Screen transitions, progress glide, press light, door intro,
  count-up totals, sheet and toast exits. It hooks how screens are swapped, so app logic is untouched.

Tuning: at the top of `lux.js`, `INTRO = false` turns the door intro off. Add `?intro` to the URL to replay it.
People with iOS/Android "Reduce Motion" on get no transitions or intro automatically.
Remember to upload `lux.css` and `lux.js` along with the other files; the service worker cache is now `safety-v16`.

## Drafts

Every form can be closed and finished later. Tap **Close** (top right) for Save draft / Discard / Stay, or use the
**Save draft** button on the last screens (Add Day 2, Review, Timesheet summary). Drafts appear on the home screen under
**Resume drafts** and reopen on the exact step you left. A Daily Hazard Assessment saved after Day 1 reopens at "Add Day 2?".
