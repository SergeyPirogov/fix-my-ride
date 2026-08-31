# Fix My Ride — Design Spec
**Date:** 2026-08-31  
**Status:** Approved

---

## Overview

A browser-only web app that lets cyclists and runners repair broken GPS segments in their activity files. The user loads a ride (`.fit` / `.gpx`), selects the broken segment on a map, chooses a road-snapped route suggestion (or draws manually), and downloads a corrected `.fit` file. No backend. No accounts. No Strava OAuth.

---

## Scope

**In:**
- Parse `.fit` and `.gpx` files entirely in the browser
- Interactive map (Leaflet + OpenStreetMap tiles) showing the full activity track
- Broken segment detection (large jumps, zero-signal gaps) + manual selection
- Route suggestions via OSRM public API (cycling and running profiles)
- Manual waypoint drawing mode
- FIT file generation with corrected GPS + interpolated timestamps/heart rate/power
- Download corrected `.fit` file

**Out:**
- Strava OAuth / upload to Strava (user downloads and re-uploads manually)
- User accounts or server-side storage
- Multi-segment fix in one session (one gap per session; reload for another)
- Elevation correction (use original elevation data where available; interpolate linearly across gap)

---

## User Flow

```
1. LOAD      Upload .fit/.gpx  ──or──  drag-drop
               ↓
             Parse file in browser → detect GPS gaps automatically
               ↓
2. SELECT    Map shows full track. Broken gaps highlighted in red (dashed).
             User clicks track to set Start (S) and End (E) handles.
             Handles are draggable. Elevation strip mirrors selection.
               ↓
3. FIX       App calls OSRM for route between S and E (cycling or running profile).
             Right panel shows up to 3 route suggestions with mini-map + stats.
             User picks one — or switches to "Draw" mode to place waypoints manually.
             Selected route previews green on main map.
               ↓
4. EXPORT    "Download .fit" generates corrected file.
             Original data preserved outside the fixed segment.
             Interpolated: timestamps, distance, optionally HR/power (flat fill).
```

---

## Architecture

Pure client-side SPA. No build step required for MVP; Vite for production build.

```
src/
  main.js              Entry point, app shell
  store.js             Lightweight reactive state (plain JS, no framework)
  
  io/
    fit-parser.js      Wrap fit-file-parser npm lib → internal track format
    gpx-parser.js      Parse GPX XML → same internal format
    fit-writer.js      Build corrected FIT binary from internal format
  
  map/
    map.js             Leaflet init, tile layer (OSM), track rendering
    track-layer.js     Polyline layers: good (blue), broken (red dashed), suggestion (green)
    selection.js       Click-to-set S/E, draggable handles, elevation strip sync
    draw-mode.js       Manual waypoint placement → polyline
  
  routing/
    osrm.js            Calls OSRM public API, returns GeoJSON route
                       Endpoint: https://router.project-osrm.org/route/v1/{profile}
                       Profile: "cycling" or "foot" based on activity type
    suggestions.js     Fetch up to 3 routes (direct + 1-2 via-point variants),
                       score by distance deviation from original track average
  
  ui/
    sidebar.js         File drop zone, recent files (sessionStorage), activity list
    panel.js           Suggestion cards, stats, action buttons
    stepbar.js         Step indicator (Load → Select → Fix → Export)
    elevation.js       SVG elevation strip with selection bracket
```

### Internal Track Format

```js
{
  activityType: 'cycling' | 'running',
  points: [
    { lat, lng, ele, timestamp, hr?, power?, cadence?, distance }
  ],
  gaps: [{ startIdx, endIdx, distanceJump }]  // auto-detected on load
}
```

Gap detection: consecutive points where distance jump > 200m **and** time gap < 5 min (i.e., GPS dropped, athlete kept moving).

---

## Routing (OSRM)

- Base URL: `https://router.project-osrm.org/route/v1/{profile}/{lng,lat};{lng,lat}?overview=full&geometries=geojson&alternatives=true`
- `profile`: `cycling` for bike activities, `foot` for run/hike
- `alternatives=true` returns up to 3 routes
- Each suggestion scored: `matchScore = 1 - abs(suggestedDist - gapDist) / gapDist` (clamped 0–1)
- Suggestions ranked by matchScore descending
- Rate limiting: OSRM public API — one call per fix, not spammed. Add 500ms debounce on handle drag.

---

## FIT File Generation

Library: `fit-file-creator` (npm) or hand-roll binary writer if library proves limiting.

Strategy:
1. Keep all original records before `startIdx` unchanged.
2. Replace records from `startIdx` to `endIdx` with interpolated records from chosen route.
3. Keep all original records after `endIdx` unchanged.
4. Interpolate timestamps linearly across the fixed segment (preserve total elapsed time).
5. Recalculate cumulative distance field.
6. HR/power/cadence: flat-fill with average of last 5 original points before gap.
7. Elevation: use OSRM-returned elevation if available; otherwise linear interpolate.

Point density of inserted segment: one point per ~10m along the OSRM route geometry.

---

## UI Design

**Stack:** Vanilla JS + Leaflet. No React/Vue — keeps bundle small, no virtual DOM needed for a map-first tool.

**Palette:**
- Light: `#F8FAFC` bg, `#0F172A` text, `#2563EB` accent, `#10B981` success, `#EF4444` broken
- Dark: `#0D1117` bg, `#F0F6FF` text, `#3B82F6` accent — same semantic colors

**Typography:**
- Display/labels: Barlow Condensed (athletic, compressed)
- Body/UI: Inter
- Data/coords: JetBrains Mono

**Layout:** Full-height app shell. Left sidebar (260px) — load + history. Map center (flex-1). Right panel (300px) — suggestions + actions. Elevation strip overlaid at map bottom.

**Map track encoding:**
- Blue solid = good GPS data
- Red dashed = broken/missing segment  
- Green solid = selected fix route

---

## State Machine

```
IDLE → LOADED → SEGMENT_SELECTED → FIXING → ROUTE_CHOSEN → EXPORTED
         ↑                              ↓
         └──────────── reset ───────────┘
```

Transitions are plain function calls on a shared state object. No framework needed.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Unsupported file format | Toast: "Only .fit and .gpx files are supported" |
| No GPS data in file | Toast: "No GPS data found in this file" |
| OSRM API unreachable | Show "Manual draw" mode automatically; toast explaining why |
| OSRM returns no route | Toast: "No road route found — try drawing manually" |
| FIT write fails | Toast: "Export failed — check browser console for details" |
| Gap too small (< 50m) | Warn: "This gap may not need fixing (under 50m)" |

---

## Out-of-Scope Decisions

- **No undo/redo** — user can reload to start over
- **No GPX export** — FIT only (Strava accepts FIT)
- **No multi-user** — no backend, no accounts
- **No offline** — OSRM calls require network; map tiles require network
- **No mobile optimization** — desktop-first; map interaction is pointer-based

---

## Dependencies

| Package | Purpose |
|---|---|
| `fit-file-parser` | Parse .fit binary |
| `leaflet` | Map rendering |
| `vite` | Build tooling |

FIT writing: use `fit-file-creator`; if it cannot set arbitrary record fields (HR, power, cadence), write a minimal custom FIT binary writer targeting only the fields we need.  
GPX parsing: native DOMParser, no extra lib needed.  
OSRM: fetch, no SDK.
