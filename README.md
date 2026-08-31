# Fix My Ride

Fix broken GPS in a cycling/running activity by replacing its route with a clean reference track — right in the browser, no backend, no upload to a server.

**Live app:** https://automation-remarks.com/fix-my-ride/

## Why

GPS occasionally glitches mid-ride: a dropped signal, a satellite jump, a tunnel. The result is a `.fit` file with a wild spike or a straight-line teleport across the map. Fix My Ride replaces the broken track's geography with a known-good `.gpx` route while keeping the original ride's time, heart rate, power, and cadence data intact.

## How it works

1. **Upload the broken `.fit` file** — the activity you actually recorded, gaps and all.
2. **Upload a reference `.gpx` route** — a clean track covering the same path (e.g. exported from a mapping tool, or another activity that followed the correct route).
3. **Fix using GPX** — the app resamples the GPX path and remaps your ride's recorded heart rate, power, and cadence onto it by distance, so pacing and effort stay accurate even though the coordinates now come from the clean route.
4. **Review** — the map shows the fixed route, and an analysis panel below it charts elevation, speed, heart rate, and power. Hover or drag over the charts to see exact values and a matching marker on the map.
5. **Download** — export the corrected `.fit` file, ready to re-upload to Strava or any other platform.

## Stack

- Vanilla JS (ES modules), no framework
- [Leaflet](https://leafletjs.com/) for the map
- [fit-file-parser](https://github.com/jimmykane/fit-parser) for reading `.fit` files
- A small hand-rolled binary writer for producing valid `.fit` output (file_id/session/lap/record messages)
- [Vite](https://vitejs.dev/) for dev server and build
- [Vitest](https://vitest.dev/) for unit tests

Everything runs client-side — files never leave your browser.

## Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

```bash
npm test          # run the test suite once
npm run test:watch
npm run build      # production build to dist/
```

## Deployment

Pushing to `main` builds the app and deploys `dist/` to GitHub Pages via the workflow in `.github/workflows/deploy.yml`.
