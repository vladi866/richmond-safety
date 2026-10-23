# Richmond Elevator — Safety & Timesheet App

Mobile web app (PWA) combining:
1. **ToolBox Meeting** (`tb.png` PDF output)
2. **Daily Hazard Assessment / JHA** (`jha.png` PDF output, 1 or 2 days per sheet)
3. **Construction / Modernization Timesheet** (`timesheet.html`, 2-week PDF + receipt photos)

## How It Works
- **Shared Safety Library (Supabase):** Connected to `https://fgfkqsbasgjpwpkqjoar.supabase.co`. Any new **ToolBox Topic + Corrective Action** or **JHA Scope + Step + Hazard + Control** entered from scratch is saved to the shared `lib` table when a PDF is saved and becomes available to all other mechanics via the `🎲` randomizer and auto-fill.
- **Remembering Each Worker:** Each phone generates a persistent Device ID (`dev`) and stores the worker's name (`profile`) in both `localStorage` and a 10-year first-party cookie (`re_dev`, `re_profile`). Entering your name once on **Timesheet**, **ToolBox**, or **JHA** automatically remembers and pre-fills it across all 3 forms.

## Deploying to GitHub Pages
1. Create a new repository on GitHub (e.g., `richmond-safety`).
2. Upload all files in this folder (`index.html`, `timesheet.html`, `seed.js`, `sw.js`, `manifest.json`, `icon.png`, `tb.png`, `jha.png`, `README.md`) to the root of the repository.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**, select **`main`** and **`/ (root)`**, and click **Save**.
5. On iPhone: open your GitHub Pages URL in **Safari → Share → Add to Home Screen**.
