# Fix My Ride Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-only web app that lets cyclists/runners repair broken GPS segments in .fit/.gpx files using OSRM road-snapped route suggestions, then download a corrected .fit file.

**Architecture:** Vanilla JS SPA with Vite build. Leaflet for map rendering. All parsing, routing, and FIT generation happens in the browser — no backend. State flows through a single shared store object.

**Tech Stack:** Vite, Vanilla JS (ES modules), Leaflet, fit-file-parser, fit-file-creator, OSRM public API

## Global Constraints

- Browser-only: no server, no backend calls except OSRM public API and OSM tile CDN
- Activity types: `cycling` and `running` only
- FIT output only (no GPX export)
- One gap fix per session; user reloads for another
- Gap detection threshold: distance jump > 200m AND time gap < 5 min
- OSRM endpoint: `https://router.project-osrm.org/route/v1/{profile}/{lng,lat};{lng,lat}?overview=full&geometries=geojson&alternatives=true`
- Profile mapping: `cycling` activity → `cycling`, `running` activity → `foot`
- matchScore formula: `Math.max(0, 1 - Math.abs(suggestedDist - gapDist) / gapDist)`
- Point density for inserted segment: one point per ~10m
- HR/power/cadence fill: average of last 5 original points before gap
- Desktop-first; no mobile optimization required

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/style.css`

**Interfaces:**
- Produces: running dev server at `http://localhost:5173`, app shell renders

- [ ] **Step 1: Initialize project**

```bash
cd /Users/spirohov/work/fix-my-ride
npm init -y
npm install --save-dev vite
npm install leaflet fit-file-parser fit-file-creator
```

- [ ] **Step 2: Create `vite.config.js`**

```js
// vite.config.js
export default {
  server: { port: 5173 },
}
```

- [ ] **Step 3: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fix My Ride</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <div id="app">
    <div id="topbar"></div>
    <div id="app-body">
      <div id="sidebar"></div>
      <div id="map"></div>
      <div id="right-panel"></div>
    </div>
  </div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create `src/main.js`**

```js
// src/main.js
import './style.css'

document.querySelector('#app').innerHTML += ''
console.log('Fix My Ride loaded')
```

- [ ] **Step 5: Create `src/style.css`** with CSS custom properties

```css
/* src/style.css */
:root {
  --bg: #F8FAFC;
  --bg-2: #EFF3F8;
  --bg-3: #E2E8F0;
  --surface: #FFFFFF;
  --border: #CBD5E1;
  --text: #0F172A;
  --text-2: #475569;
  --text-3: #94A3B8;
  --accent: #2563EB;
  --accent-hover: #1D4ED8;
  --accent-subtle: #DBEAFE;
  --success: #10B981;
  --success-subtle: #D1FAE5;
  --warning: #F59E0B;
  --broken: #EF4444;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0D1117;
    --bg-2: #161B22;
    --bg-3: #21262D;
    --surface: #1C2128;
    --border: #30363D;
    --text: #F0F6FF;
    --text-2: #8B949E;
    --text-3: #484F58;
    --accent: #3B82F6;
    --accent-hover: #60A5FA;
    --accent-subtle: #1D3461;
    --success: #10B981;
    --success-subtle: #0D3325;
  }
}

:root[data-theme="dark"] {
  --bg: #0D1117;
  --bg-2: #161B22;
  --bg-3: #21262D;
  --surface: #1C2128;
  --border: #30363D;
  --text: #F0F6FF;
  --text-2: #8B949E;
  --text-3: #484F58;
  --accent: #3B82F6;
  --accent-hover: #60A5FA;
  --accent-subtle: #1D3461;
  --success: #10B981;
  --success-subtle: #0D3325;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

#app { display: flex; flex-direction: column; height: 100vh; }

#app-body { display: flex; flex: 1; overflow: hidden; }

#map { flex: 1; position: relative; z-index: 0; }

.leaflet-container { background: var(--bg-2); }
```

- [ ] **Step 6: Add scripts to `package.json`**

Edit `package.json` to add:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Expected: `VITE v5.x.x  ready in Xms` and `http://localhost:5173` loads blank page with "Fix My Ride loaded" in console.

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Vite project with app shell"
```

---

### Task 2: Store (State Machine)

**Files:**
- Create: `src/store.js`
- Create: `src/store.test.js`

**Interfaces:**
- Produces:
  - `store.state` — object with shape `{ phase, track, segmentStart, segmentEnd, suggestions, chosenRoute }`
  - `store.setState(partial)` — merges partial into state, calls subscribers
  - `store.subscribe(fn)` — `fn(state)` called on every setState
  - `store.reset()` — returns to IDLE phase

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-dev vitest
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Write failing tests**

```js
// src/store.test.js
import { describe, it, expect, vi } from 'vitest'
import { store } from './store.js'

describe('store', () => {
  it('starts in IDLE phase', () => {
    store.reset()
    expect(store.state.phase).toBe('IDLE')
  })

  it('setState merges partial state', () => {
    store.reset()
    store.setState({ phase: 'LOADED' })
    expect(store.state.phase).toBe('LOADED')
    expect(store.state.track).toBeNull()
  })

  it('notifies subscribers on setState', () => {
    store.reset()
    const fn = vi.fn()
    const unsub = store.subscribe(fn)
    store.setState({ phase: 'LOADED' })
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ phase: 'LOADED' }))
    unsub()
  })

  it('unsubscribe stops notifications', () => {
    store.reset()
    const fn = vi.fn()
    const unsub = store.subscribe(fn)
    unsub()
    store.setState({ phase: 'LOADED' })
    expect(fn).not.toHaveBeenCalled()
  })

  it('reset returns to IDLE', () => {
    store.setState({ phase: 'ROUTE_CHOSEN', segmentStart: 5 })
    store.reset()
    expect(store.state.phase).toBe('IDLE')
    expect(store.state.segmentStart).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './store.js'`

- [ ] **Step 4: Implement `src/store.js`**

```js
// src/store.js
const INITIAL_STATE = {
  phase: 'IDLE',         // IDLE | LOADED | SEGMENT_SELECTED | FIXING | ROUTE_CHOSEN | EXPORTED
  track: null,           // internal track format (see spec)
  segmentStart: null,    // point index
  segmentEnd: null,      // point index
  suggestions: [],       // array of { route, distance, matchScore, label }
  chosenRoute: null,     // GeoJSON LineString coordinates array
}

const _subscribers = new Set()
let _state = { ...INITIAL_STATE }

export const store = {
  get state() { return _state },

  setState(partial) {
    _state = { ..._state, ...partial }
    _subscribers.forEach(fn => fn(_state))
  },

  subscribe(fn) {
    _subscribers.add(fn)
    return () => _subscribers.delete(fn)
  },

  reset() {
    _state = { ...INITIAL_STATE }
    _subscribers.forEach(fn => fn(_state))
  },
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test
```

Expected: 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/store.js src/store.test.js package.json
git commit -m "feat: add reactive store with state machine phases"
```

---

### Task 3: FIT + GPX Parsers → Internal Track Format

**Files:**
- Create: `src/io/fit-parser.js`
- Create: `src/io/gpx-parser.js`
- Create: `src/io/fit-parser.test.js`
- Create: `src/io/gpx-parser.test.js`

**Interfaces:**
- Consumes: nothing from prior tasks
- Produces:
  - `parseFit(arrayBuffer): Promise<Track>` — resolves to internal track format
  - `parseGpx(xmlString): Track` — returns internal track format synchronously
  - `Track` type: `{ activityType: 'cycling'|'running', points: Point[], gaps: Gap[] }`
  - `Point` type: `{ lat: number, lng: number, ele: number, timestamp: number, hr: number|null, power: number|null, cadence: number|null, distance: number }`
  - `Gap` type: `{ startIdx: number, endIdx: number, distanceJump: number }`

- [ ] **Step 1: Write failing tests for gap detection utility**

```js
// src/io/fit-parser.test.js
import { describe, it, expect } from 'vitest'
import { detectGaps } from './fit-parser.js'

describe('detectGaps', () => {
  it('returns empty array when no gaps', () => {
    const points = [
      { lat: 48.0, lng: 16.0, distance: 0, timestamp: 1000 },
      { lat: 48.001, lng: 16.0, distance: 100, timestamp: 1010 },
      { lat: 48.002, lng: 16.0, distance: 200, timestamp: 1020 },
    ]
    expect(detectGaps(points)).toEqual([])
  })

  it('detects gap when distance jump > 200m and time gap < 5min', () => {
    const points = [
      { lat: 48.0, lng: 16.0, distance: 0, timestamp: 1000 },
      { lat: 48.0, lng: 16.0, distance: 0, timestamp: 1060 },   // 60s later
      { lat: 48.003, lng: 16.003, distance: 450, timestamp: 1120 }, // 450m jump in 60s
    ]
    const gaps = detectGaps(points)
    expect(gaps).toHaveLength(1)
    expect(gaps[0].startIdx).toBe(1)
    expect(gaps[0].endIdx).toBe(2)
    expect(gaps[0].distanceJump).toBeCloseTo(450, 0)
  })

  it('ignores gap if time elapsed > 5 minutes (intentional stop)', () => {
    const points = [
      { lat: 48.0, lng: 16.0, distance: 0, timestamp: 1000 },
      { lat: 48.003, lng: 16.003, distance: 450, timestamp: 1000 + 360 }, // 6 min gap
    ]
    expect(detectGaps(points)).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './fit-parser.js'`

- [ ] **Step 3: Implement `src/io/fit-parser.js`**

```js
// src/io/fit-parser.js
import FitParser from 'fit-file-parser'

const SPORT_MAP = { cycling: 'cycling', running: 'running', 0: 'cycling', 1: 'running' }
const GAP_DISTANCE_THRESHOLD = 200  // metres
const GAP_TIME_THRESHOLD = 5 * 60  // seconds

function haversineDistance(p1, p2) {
  const R = 6371000
  const lat1 = p1.lat * Math.PI / 180
  const lat2 = p2.lat * Math.PI / 180
  const dLat = (p2.lat - p1.lat) * Math.PI / 180
  const dLng = (p2.lng - p1.lng) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function detectGaps(points) {
  const gaps = []
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const timeDiff = (curr.timestamp - prev.timestamp) / 1000
    const distJump = curr.distance - prev.distance
    if (distJump > GAP_DISTANCE_THRESHOLD && timeDiff < GAP_TIME_THRESHOLD) {
      gaps.push({ startIdx: i - 1, endIdx: i, distanceJump: distJump })
    }
  }
  return gaps
}

export function parseFit(arrayBuffer) {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({ force: true, speedUnit: 'km/h', lengthUnit: 'm', elapsedRecordField: true, mode: 'both' })
    parser.parse(arrayBuffer, (err, data) => {
      if (err) return reject(err)
      const session = data.activity?.sessions?.[0]
      const sport = session?.sport ?? 'cycling'
      const activityType = SPORT_MAP[sport] ?? 'cycling'
      const records = data.activity?.sessions?.flatMap(s => s.laps?.flatMap(l => l.records ?? []) ?? []) ?? []
      const points = records
        .filter(r => r.position_lat != null && r.position_long != null)
        .map(r => ({
          lat: r.position_lat,
          lng: r.position_long,
          ele: r.altitude ?? 0,
          timestamp: r.timestamp instanceof Date ? r.timestamp.getTime() : r.timestamp * 1000,
          hr: r.heart_rate ?? null,
          power: r.power ?? null,
          cadence: r.cadence ?? null,
          distance: r.distance ?? 0,
        }))
      if (points.length === 0) return reject(new Error('No GPS data found in this file'))
      const gaps = detectGaps(points)
      resolve({ activityType, points, gaps })
    })
  })
}
```

- [ ] **Step 4: Write failing GPX parser tests**

```js
// src/io/gpx-parser.test.js
import { describe, it, expect } from 'vitest'
import { parseGpx } from './gpx-parser.js'

const MINIMAL_GPX = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <type>cycling</type>
    <trkseg>
      <trkpt lat="48.2000" lon="16.3000">
        <ele>180</ele>
        <time>2024-08-01T08:00:00Z</time>
        <extensions><hr>140</hr></extensions>
      </trkpt>
      <trkpt lat="48.2010" lon="16.3010">
        <ele>182</ele>
        <time>2024-08-01T08:00:10Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`

describe('parseGpx', () => {
  it('parses points from GPX string', () => {
    const track = parseGpx(MINIMAL_GPX)
    expect(track.points).toHaveLength(2)
    expect(track.points[0].lat).toBeCloseTo(48.2, 3)
    expect(track.points[0].lng).toBeCloseTo(16.3, 3)
    expect(track.points[0].ele).toBe(180)
  })

  it('detects activity type from trk type element', () => {
    const track = parseGpx(MINIMAL_GPX)
    expect(track.activityType).toBe('cycling')
  })

  it('defaults to cycling if type missing', () => {
    const gpx = MINIMAL_GPX.replace('<type>cycling</type>', '')
    const track = parseGpx(gpx)
    expect(track.activityType).toBe('cycling')
  })

  it('throws if no GPS points found', () => {
    const gpx = `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk></trk></gpx>`
    expect(() => parseGpx(gpx)).toThrow('No GPS data found in this file')
  })
})
```

- [ ] **Step 5: Run to verify GPX tests fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './gpx-parser.js'`

- [ ] **Step 6: Implement `src/io/gpx-parser.js`**

```js
// src/io/gpx-parser.js
import { detectGaps } from './fit-parser.js'

const SPORT_MAP = {
  cycling: 'cycling', biking: 'cycling', bike: 'cycling',
  running: 'running', run: 'running',
}

export function parseGpx(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml')
  const ns = 'http://www.topografix.com/GPX/1/1'
  const trkType = doc.querySelector('trk > type')?.textContent?.toLowerCase() ?? ''
  const activityType = SPORT_MAP[trkType] ?? 'cycling'

  let cumulativeDistance = 0
  const trkpts = Array.from(doc.querySelectorAll('trkpt'))
  if (trkpts.length === 0) throw new Error('No GPS data found in this file')

  const points = trkpts.map((pt, i) => {
    const lat = parseFloat(pt.getAttribute('lat'))
    const lng = parseFloat(pt.getAttribute('lon'))
    const ele = parseFloat(pt.querySelector('ele')?.textContent ?? '0')
    const timeStr = pt.querySelector('time')?.textContent
    const timestamp = timeStr ? new Date(timeStr).getTime() : i * 1000
    const hr = pt.querySelector('hr') ? parseInt(pt.querySelector('hr').textContent) : null
    const power = pt.querySelector('power') ? parseInt(pt.querySelector('power').textContent) : null
    const cadence = pt.querySelector('cadence') ? parseInt(pt.querySelector('cadence').textContent) : null

    if (i > 0) {
      const prev = points[i - 1]
      const R = 6371000
      const lat1 = prev.lat * Math.PI / 180
      const lat2 = lat * Math.PI / 180
      const dLat = (lat - prev.lat) * Math.PI / 180
      const dLng = (lng - prev.lng) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
      cumulativeDistance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    return { lat, lng, ele, timestamp, hr, power, cadence, distance: Math.round(cumulativeDistance) }
  })

  return { activityType, points, gaps: detectGaps(points) }
}
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: all tests PASS (store tests + gap detection + gpx parser)

- [ ] **Step 8: Commit**

```bash
git add src/io/
git commit -m "feat: add FIT and GPX parsers with gap detection"
```

---

### Task 4: App Shell UI (Topbar, Sidebar, Right Panel)

**Files:**
- Create: `src/ui/topbar.js`
- Create: `src/ui/sidebar.js`
- Create: `src/ui/panel.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `store.state`, `store.setState`, `store.subscribe` from `src/store.js`
- Produces:
  - `initTopbar()` — renders topbar DOM into `#topbar`, subscribes to store for step updates
  - `initSidebar({ onFile })` — renders sidebar into `#sidebar`; calls `onFile(file)` when user picks a file
  - `initPanel()` — renders right panel shell into `#right-panel`, subscribes to store for suggestion updates
  - `showToast(message, type?)` — `type`: `'error'|'warning'|'success'`, defaults to `'error'`

- [ ] **Step 1: Create `src/ui/topbar.js`**

```js
// src/ui/topbar.js
import { store } from '../store.js'

const STEPS = ['Load', 'Select', 'Fix', 'Export']
const PHASE_STEP = {
  IDLE: 0, LOADED: 1, SEGMENT_SELECTED: 1,
  FIXING: 2, ROUTE_CHOSEN: 2, EXPORTED: 3,
}

export function initTopbar() {
  const el = document.getElementById('topbar')
  el.className = 'topbar'

  function render(state) {
    const current = PHASE_STEP[state.phase] ?? 0
    el.innerHTML = `
      <div class="logo">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="8" stroke="currentColor" stroke-width="1.5"/>
          <path d="M9 4 L9 9 L13 11" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="9" cy="9" r="1.5" fill="var(--accent)"/>
        </svg>
        FIX<span class="logo-dot">.</span>RIDE
      </div>
      <div class="topbar-sep"></div>
      <div class="step-indicator">
        ${STEPS.map((s, i) => {
          const cls = i < current ? 'done' : i === current ? 'active' : ''
          const num = i < current ? '✓' : i + 1
          return `
            ${i > 0 ? '<span class="step-arrow">›</span>' : ''}
            <div class="step ${cls}"><div class="step-num">${num}</div>${s}</div>
          `
        }).join('')}
      </div>
      <div class="topbar-actions">
        <button class="theme-toggle" id="theme-toggle">◐</button>
        ${state.phase !== 'IDLE' ? '<button class="btn btn-ghost" id="btn-reset">Discard</button>' : ''}
        ${state.phase === 'ROUTE_CHOSEN' ? '<button class="btn btn-primary" id="btn-apply">Apply Fix</button>' : ''}
      </div>
    `
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      const root = document.documentElement
      root.setAttribute('data-theme', root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark')
    })
    document.getElementById('btn-reset')?.addEventListener('click', () => store.reset())
    document.getElementById('btn-apply')?.addEventListener('click', () =>
      store.setState({ phase: 'EXPORTED' })
    )
  }

  render(store.state)
  store.subscribe(render)
}
```

- [ ] **Step 2: Create `src/ui/sidebar.js`**

```js
// src/ui/sidebar.js
import { store } from '../store.js'

export function initSidebar({ onFile }) {
  const el = document.getElementById('sidebar')
  el.className = 'sidebar'

  el.innerHTML = `
    <div class="sidebar-section">
      <div class="sidebar-label">Load Activity</div>
      <div class="upload-zone" id="upload-zone">
        <div class="upload-icon">📂</div>
        <div class="upload-text">Drop <strong>.fit</strong> or <strong>.gpx</strong> here<br>or click to browse</div>
        <input type="file" id="file-input" accept=".fit,.gpx" style="display:none" />
      </div>
    </div>
    <div id="activity-list" class="activity-list"></div>
  `

  const zone = document.getElementById('upload-zone')
  const input = document.getElementById('file-input')

  zone.addEventListener('click', () => input.click())
  input.addEventListener('change', e => { if (e.target.files[0]) onFile(e.target.files[0]) })

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over') })
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'))
  zone.addEventListener('drop', e => {
    e.preventDefault()
    zone.classList.remove('drag-over')
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  })

  store.subscribe(state => {
    const list = document.getElementById('activity-list')
    if (!list) return
    const stored = JSON.parse(sessionStorage.getItem('recentActivities') || '[]')
    list.innerHTML = stored.length ? `
      <div class="sidebar-label" style="padding: 10px 16px 4px;">Recent</div>
      ${stored.map((a, i) => `
        <div class="activity-item ${i === 0 && state.phase !== 'IDLE' ? 'active' : ''}">
          <div class="act-icon">${a.activityType === 'running' ? '🏃' : '🚴'}</div>
          <div class="act-meta">
            <div class="act-name">${a.name}</div>
            <div class="act-detail">${a.date} · ${(a.distance / 1000).toFixed(1)}km</div>
          </div>
          <span class="badge ${a.gaps > 0 ? 'badge-broken' : 'badge-fixed'}">${a.gaps > 0 ? 'Broken' : 'Fixed'}</span>
        </div>
      `).join('')}
    ` : ''
  })
}

export function recordRecentActivity(track, filename) {
  const stored = JSON.parse(sessionStorage.getItem('recentActivities') || '[]')
  const totalDist = track.points[track.points.length - 1]?.distance ?? 0
  const ts = track.points[0]?.timestamp
  const date = ts ? new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''
  stored.unshift({ name: filename.replace(/\.(fit|gpx)$/i, ''), activityType: track.activityType, date, distance: totalDist, gaps: track.gaps.length })
  sessionStorage.setItem('recentActivities', JSON.stringify(stored.slice(0, 10)))
}
```

- [ ] **Step 3: Create `src/ui/panel.js`**

```js
// src/ui/panel.js
import { store } from '../store.js'

export function initPanel({ onChoose, onDownload }) {
  const el = document.getElementById('right-panel')
  el.className = 'right-panel'

  store.subscribe(state => {
    if (state.phase === 'IDLE' || state.phase === 'LOADED') {
      el.innerHTML = ''
      return
    }
    if (state.phase === 'SEGMENT_SELECTED' || state.phase === 'FIXING') {
      el.innerHTML = `
        <div class="panel-header">
          <div>
            <div class="panel-title">Route Suggestions</div>
            <div class="panel-subtitle">Fetching routes…</div>
          </div>
        </div>
      `
      return
    }
    if (state.phase === 'ROUTE_CHOSEN' || state.phase === 'EXPORTED') {
      const gapPoints = state.track.points.slice(state.segmentStart, state.segmentEnd + 1)
      const gapDist = (state.track.points[state.segmentEnd]?.distance ?? 0) - (state.track.points[state.segmentStart]?.distance ?? 0)
      const tStart = state.track.points[state.segmentStart]?.timestamp ?? 0
      const tEnd = state.track.points[state.segmentEnd]?.timestamp ?? 0
      const gapMin = Math.round((tEnd - tStart) / 60000)

      el.innerHTML = `
        <div class="panel-header">
          <div>
            <div class="panel-title">Route Suggestions</div>
            <div class="panel-subtitle">${state.suggestions.length} routes found · gap: ${(gapDist / 1000).toFixed(1)}km</div>
          </div>
        </div>
        <div class="segment-info">
          <div class="seg-stat"><div class="seg-stat-label">Gap Distance</div><div class="seg-stat-val bad">${(gapDist / 1000).toFixed(1)} km</div></div>
          <div class="seg-stat"><div class="seg-stat-label">Duration</div><div class="seg-stat-val bad">~${gapMin} min</div></div>
          <div class="seg-stat"><div class="seg-stat-label">Surface</div><div class="seg-stat-val">Road</div></div>
          <div class="seg-stat"><div class="seg-stat-label">Type</div><div class="seg-stat-val">${state.track.activityType}</div></div>
        </div>
        <div class="suggestions-list">
          ${state.suggestions.map((s, i) => `
            <div class="suggestion-card ${state.chosenRoute === s.route ? 'selected' : ''}" data-idx="${i}">
              <div class="suggestion-body">
                <div class="suggestion-name">
                  ${s.label}
                  ${i === 0 ? '<span class="suggestion-tag tag-recommended">Recommended</span>' : ''}
                </div>
                <div class="suggestion-stats">
                  <div class="sug-stat"><div class="sug-stat-label">Distance</div><div class="sug-stat-val">${(s.distance / 1000).toFixed(2)} km</div></div>
                  <div class="sug-stat"><div class="sug-stat-label">Match</div><div class="sug-stat-val" style="color:${s.matchScore > 0.85 ? 'var(--success)' : 'var(--warning)'}">${Math.round(s.matchScore * 100)}%</div></div>
                </div>
              </div>
            </div>
          `).join('')}
          <div class="suggestion-card" id="manual-draw-card">
            <div class="suggestion-body">
              <div class="suggestion-name">Draw Manually <span class="suggestion-tag tag-manual">Custom</span></div>
              <div style="font-size:12px;color:var(--text-2);margin-top:4px">Click waypoints on the map to build your own route.</div>
            </div>
          </div>
        </div>
        <div class="panel-actions">
          <div class="action-row">
            <button class="btn btn-ghost" id="btn-back">← Back</button>
            <button class="btn btn-primary" id="btn-apply-fix" ${!state.chosenRoute ? 'disabled' : ''}>Apply Fix</button>
          </div>
          <button class="btn btn-success" id="btn-download" ${state.phase !== 'EXPORTED' ? 'disabled style="opacity:0.5"' : ''}>Download .fit</button>
        </div>
      `

      el.querySelectorAll('.suggestion-card[data-idx]').forEach(card => {
        card.addEventListener('click', () => {
          const idx = parseInt(card.dataset.idx)
          onChoose(state.suggestions[idx])
        })
      })

      document.getElementById('btn-back')?.addEventListener('click', () =>
        store.setState({ phase: 'LOADED', segmentStart: null, segmentEnd: null, suggestions: [], chosenRoute: null })
      )
      document.getElementById('btn-apply-fix')?.addEventListener('click', () =>
        store.setState({ phase: 'EXPORTED' })
      )
      document.getElementById('btn-download')?.addEventListener('click', () => onDownload())
    }
  })
}

export function showToast(message, type = 'error') {
  const existing = document.getElementById('toast')
  if (existing) existing.remove()
  const toast = document.createElement('div')
  toast.id = 'toast'
  toast.className = `toast toast-${type}`
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 4000)
}
```

- [ ] **Step 4: Add toast + sidebar CSS to `src/style.css`** (append to existing file)

```css
/* Topbar */
.topbar { height: 48px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 16px; gap: 16px; flex-shrink: 0; z-index: 10; }
.logo { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 0.04em; display: flex; align-items: center; gap: 8px; }
.logo-dot { color: var(--accent); }
.topbar-sep { width: 1px; height: 20px; background: var(--border); }
.step-indicator { display: flex; align-items: center; }
.step { display: flex; align-items: center; gap: 6px; font-size: 12px; font-family: 'Barlow Condensed', sans-serif; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3); padding: 0 12px; }
.step.active { color: var(--accent); }
.step.done { color: var(--success); }
.step-num { width: 18px; height: 18px; border-radius: 50%; background: var(--bg-3); display: flex; align-items: center; justify-content: center; font-size: 10px; font-family: 'JetBrains Mono', monospace; }
.step.active .step-num { background: var(--accent); color: #fff; }
.step.done .step-num { background: var(--success); color: #fff; }
.step-arrow { color: var(--text-3); font-size: 10px; }
.topbar-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }
.theme-toggle { width: 30px; height: 30px; border-radius: 6px; background: var(--bg-2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px; color: var(--text-2); }
.btn { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500; padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; }
.btn-ghost { background: transparent; color: var(--text-2); border: 1px solid var(--border); }
.btn-ghost:hover { background: var(--bg-2); }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-success { background: var(--success); color: #fff; }
/* Sidebar */
.sidebar { width: 260px; flex-shrink: 0; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.sidebar-section { padding: 14px 16px 10px; border-bottom: 1px solid var(--border); }
.sidebar-label { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); margin-bottom: 10px; }
.upload-zone { border: 1.5px dashed var(--border); border-radius: 8px; padding: 16px; text-align: center; cursor: pointer; background: var(--bg-2); transition: border-color 0.15s; }
.upload-zone:hover, .upload-zone.drag-over { border-color: var(--accent); background: var(--accent-subtle); }
.upload-icon { font-size: 22px; margin-bottom: 6px; }
.upload-text { font-size: 12px; color: var(--text-2); line-height: 1.4; }
.upload-text strong { color: var(--accent); }
.activity-list { flex: 1; overflow-y: auto; padding: 8px 0; }
.activity-item { display: flex; align-items: center; gap: 10px; padding: 8px 16px; cursor: pointer; transition: background 0.1s; }
.activity-item:hover { background: var(--bg-2); }
.activity-item.active { background: var(--accent-subtle); }
.act-icon { width: 28px; height: 28px; border-radius: 6px; background: var(--bg-3); display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.activity-item.active .act-icon { background: var(--accent); }
.act-meta { flex: 1; min-width: 0; }
.act-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.act-detail { font-size: 11px; color: var(--text-3); font-family: 'JetBrains Mono', monospace; margin-top: 1px; }
.badge { font-size: 10px; font-family: 'Barlow Condensed', sans-serif; font-weight: 600; letter-spacing: 0.06em; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }
.badge-broken { background: #FEE2E2; color: #DC2626; }
.badge-fixed { background: var(--success-subtle); color: var(--success); }
/* Right panel */
.right-panel { width: 300px; flex-shrink: 0; background: var(--surface); border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.panel-header { padding: 14px 16px; border-bottom: 1px solid var(--border); }
.panel-title { font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.panel-subtitle { font-size: 11px; color: var(--text-3); margin-top: 2px; font-family: 'JetBrains Mono', monospace; }
.segment-info { padding: 12px 16px; background: var(--bg-2); border-bottom: 1px solid var(--border); display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.seg-stat { display: flex; flex-direction: column; gap: 2px; }
.seg-stat-label { font-size: 10px; font-family: 'Barlow Condensed', sans-serif; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); }
.seg-stat-val { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 500; }
.seg-stat-val.bad { color: var(--broken); }
.suggestions-list { flex: 1; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.suggestion-card { border: 1.5px solid var(--border); border-radius: 8px; overflow: hidden; cursor: pointer; transition: border-color 0.15s; }
.suggestion-card:hover, .suggestion-card.selected { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-subtle); }
.suggestion-body { padding: 10px 12px; }
.suggestion-name { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; }
.suggestion-tag { font-size: 10px; font-weight: 600; letter-spacing: 0.06em; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }
.tag-recommended { background: var(--accent-subtle); color: var(--accent); }
.tag-manual { background: var(--bg-3); color: var(--text-2); }
.suggestion-stats { display: flex; gap: 12px; }
.sug-stat { display: flex; flex-direction: column; gap: 1px; }
.sug-stat-label { font-size: 10px; font-family: 'Barlow Condensed', sans-serif; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); }
.sug-stat-val { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
.panel-actions { padding: 12px 16px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
.action-row { display: flex; gap: 8px; }
.action-row .btn { flex: 1; text-align: center; }
/* Toast */
.toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; z-index: 9999; white-space: nowrap; }
.toast-error { background: #FEE2E2; color: #DC2626; border: 1px solid #FECACA; }
.toast-warning { background: #FEF3C7; color: #D97706; border: 1px solid #FDE68A; }
.toast-success { background: var(--success-subtle); color: var(--success); border: 1px solid #6EE7B7; }
/* Map mode bar */
.map-mode-bar { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); display: flex; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); z-index: 1000; }
.map-mode-btn { padding: 6px 14px; font-size: 12px; font-family: 'Barlow Condensed', sans-serif; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; color: var(--text-2); background: transparent; border: none; border-right: 1px solid var(--border); }
.map-mode-btn:last-child { border-right: none; }
.map-mode-btn.active { background: var(--accent); color: #fff; }
.map-mode-btn:hover:not(.active) { background: var(--bg-2); }
.map-zoom-controls { position: absolute; top: 14px; left: 14px; display: flex; flex-direction: column; gap: 2px; z-index: 1000; }
.map-zoom-btn { width: 30px; height: 30px; background: var(--surface); border: 1px solid var(--border); border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; font-weight: 600; color: var(--text-2); }
.map-zoom-btn:hover { background: var(--bg-2); }
.selection-hint { position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%); background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 16px; font-size: 12px; color: var(--text-2); display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); z-index: 1000; white-space: nowrap; }
.hint-key { background: var(--bg-3); border: 1px solid var(--border); border-radius: 3px; padding: 1px 6px; font-size: 11px; font-family: 'JetBrains Mono', monospace; }
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
```

- [ ] **Step 5: Wire up `src/main.js`**

```js
// src/main.js
import './style.css'
import { store } from './store.js'
import { initTopbar } from './ui/topbar.js'
import { initSidebar, recordRecentActivity } from './ui/sidebar.js'
import { initPanel, showToast } from './ui/panel.js'
import { parseFit } from './io/fit-parser.js'
import { parseGpx } from './io/gpx-parser.js'

async function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext !== 'fit' && ext !== 'gpx') {
    showToast('Only .fit and .gpx files are supported')
    return
  }
  try {
    let track
    if (ext === 'fit') {
      const buf = await file.arrayBuffer()
      track = await parseFit(buf)
    } else {
      const text = await file.text()
      track = parseGpx(text)
    }
    recordRecentActivity(track, file.name)
    store.setState({ phase: 'LOADED', track })
  } catch (e) {
    showToast(e.message || 'Failed to parse file')
  }
}

initTopbar()
initSidebar({ onFile: handleFile })
initPanel({ onChoose: () => {}, onDownload: () => {} })
```

- [ ] **Step 6: Verify in browser**

```bash
npm run dev
```

Expected: App shell renders with topbar (FIX.RIDE logo + step bar), empty sidebar with upload zone, and empty right panel. Theme toggle works.

- [ ] **Step 7: Commit**

```bash
git add src/ui/ src/main.js src/style.css
git commit -m "feat: add app shell — topbar, sidebar, right panel"
```

---

### Task 5: Map Initialization + Track Rendering

**Files:**
- Create: `src/map/map.js`
- Create: `src/map/track-layer.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `store.state.track` (Track format from Task 3)
- Produces:
  - `initMap(): LeafletMap` — creates Leaflet map in `#map`, returns map instance
  - `renderTrack(map, track)` — clears existing layers, renders good/broken polylines, fits bounds
  - `clearTrack(map)` — removes all track layers

- [ ] **Step 1: Create `src/map/map.js`**

```js
// src/map/map.js
import L from 'leaflet'

export function initMap() {
  const map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    center: [48.2, 16.37],
    zoom: 13,
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map)

  // Custom zoom controls (sidebar has its own chrome)
  const zoomDiv = document.createElement('div')
  zoomDiv.className = 'map-zoom-controls'
  zoomDiv.innerHTML = `
    <button class="map-zoom-btn" id="zoom-in">+</button>
    <button class="map-zoom-btn" id="zoom-out">−</button>
  `
  document.getElementById('map').appendChild(zoomDiv)
  document.getElementById('zoom-in').addEventListener('click', () => map.zoomIn())
  document.getElementById('zoom-out').addEventListener('click', () => map.zoomOut())

  return map
}
```

- [ ] **Step 2: Create `src/map/track-layer.js`**

```js
// src/map/track-layer.js
import L from 'leaflet'

const LAYER_KEY = '__trackLayers'

export function renderTrack(map, track) {
  clearTrack(map)
  if (!track || track.points.length === 0) return

  const gapIdxSet = new Set()
  track.gaps.forEach(g => {
    for (let i = g.startIdx; i <= g.endIdx; i++) gapIdxSet.add(i)
  })

  // Build segments: alternating good/bad
  let currentSegment = []
  let currentIsBroken = gapIdxSet.has(0)
  const segments = []

  track.points.forEach((pt, i) => {
    const broken = gapIdxSet.has(i)
    if (broken !== currentIsBroken && currentSegment.length > 0) {
      segments.push({ points: currentSegment, broken: currentIsBroken })
      currentSegment = []
      currentIsBroken = broken
    }
    currentSegment.push([pt.lat, pt.lng])
  })
  if (currentSegment.length > 0) segments.push({ points: currentSegment, broken: currentIsBroken })

  const layers = []
  segments.forEach(seg => {
    if (seg.broken) {
      const line = L.polyline(seg.points, {
        color: '#EF4444', weight: 3, opacity: 0.9,
        dashArray: '8 6',
      }).addTo(map)
      layers.push(line)
    } else {
      const line = L.polyline(seg.points, {
        color: '#2563EB', weight: 4, opacity: 0.9,
      }).addTo(map)
      layers.push(line)
    }
  })

  map[LAYER_KEY] = layers
  if (layers.length > 0) {
    const allLatLngs = track.points.map(p => [p.lat, p.lng])
    map.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40] })
  }
}

export function clearTrack(map) {
  const layers = map[LAYER_KEY] || []
  layers.forEach(l => map.removeLayer(l))
  map[LAYER_KEY] = []
}

export function addSuggestionLayer(map, geoJsonCoords, color = '#10B981') {
  const latlngs = geoJsonCoords.map(([lng, lat]) => [lat, lng])
  const line = L.polyline(latlngs, { color, weight: 4, opacity: 0.85 })
  line.addTo(map)
  return line
}

export function removeSuggestionLayer(map, layer) {
  if (layer) map.removeLayer(layer)
}
```

- [ ] **Step 3: Update `src/main.js`** to init map and subscribe to track changes

```js
// src/main.js
import './style.css'
import { store } from './store.js'
import { initTopbar } from './ui/topbar.js'
import { initSidebar, recordRecentActivity } from './ui/sidebar.js'
import { initPanel, showToast } from './ui/panel.js'
import { parseFit } from './io/fit-parser.js'
import { parseGpx } from './io/gpx-parser.js'
import { initMap } from './map/map.js'
import { renderTrack, clearTrack } from './map/track-layer.js'

async function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext !== 'fit' && ext !== 'gpx') {
    showToast('Only .fit and .gpx files are supported')
    return
  }
  try {
    let track
    if (ext === 'fit') {
      const buf = await file.arrayBuffer()
      track = await parseFit(buf)
    } else {
      const text = await file.text()
      track = parseGpx(text)
    }
    recordRecentActivity(track, file.name)
    store.setState({ phase: 'LOADED', track })
  } catch (e) {
    showToast(e.message || 'Failed to parse file')
  }
}

const map = initMap()

initTopbar()
initSidebar({ onFile: handleFile })
initPanel({ onChoose: () => {}, onDownload: () => {} })

store.subscribe(state => {
  if (state.phase === 'IDLE') { clearTrack(map); return }
  if (state.track) renderTrack(map, state.track)
})
```

- [ ] **Step 4: Verify in browser**

Load app, drop in a GPX file (create a minimal test GPX at `/tmp/test.gpx`):

```xml
<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><type>cycling</type><trkseg>
    <trkpt lat="48.200" lon="16.300"><ele>180</ele><time>2024-08-01T08:00:00Z</time></trkpt>
    <trkpt lat="48.201" lon="16.301"><ele>182</ele><time>2024-08-01T08:00:10Z</time></trkpt>
    <trkpt lat="48.204" lon="16.305"><ele>185</ele><time>2024-08-01T08:00:20Z</time></trkpt>
  </trkseg></trk>
</gpx>
```

Expected: map centers on track, blue polyline renders, step bar advances to step 2.

- [ ] **Step 5: Commit**

```bash
git add src/map/
git commit -m "feat: add Leaflet map with track rendering"
```

---

### Task 6: Segment Selection (S/E handles)

**Files:**
- Create: `src/map/selection.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `store.state.track`, `store.setState`, map instance from Task 5
- Produces:
  - `initSelection(map, { onSegmentChange })` — attaches click handler to map; calls `onSegmentChange(startIdx, endIdx)` when both handles placed

- [ ] **Step 1: Create `src/map/selection.js`**

```js
// src/map/selection.js
import L from 'leaflet'
import { store } from '../store.js'

const DEBOUNCE_MS = 500

function nearestPointIndex(track, latlng) {
  let minDist = Infinity
  let minIdx = 0
  track.points.forEach((pt, i) => {
    const d = Math.hypot(pt.lat - latlng.lat, pt.lng - latlng.lng)
    if (d < minDist) { minDist = d; minIdx = i }
  })
  return minIdx
}

function makeHandle(map, latlng, color, label) {
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 2px ${color};display:flex;align-items:center;justify-content:center;font-size:8px;color:#fff;font-weight:700;font-family:Inter,sans-serif">${label}</div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
  return L.marker(latlng, { icon, draggable: true }).addTo(map)
}

export function initSelection(map, { onSegmentChange }) {
  let startMarker = null
  let endMarker = null
  let startIdx = null
  let endIdx = null
  let modeBar = null
  let hint = null
  let debounceTimer = null

  function notify() {
    if (startIdx !== null && endIdx !== null) {
      const [s, e] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
      const dist = Math.abs((store.state.track?.points[e]?.distance ?? 0) - (store.state.track?.points[s]?.distance ?? 0))
      if (dist < 50) {
        import('../ui/panel.js').then(m => m.showToast('This gap may not need fixing (under 50m)', 'warning'))
      }
      onSegmentChange(s, e)
    }
  }

  function activate(track) {
    map.off('click', onMapClick)

    if (!modeBar) {
      modeBar = document.createElement('div')
      modeBar.className = 'map-mode-bar'
      modeBar.innerHTML = `
        <button class="map-mode-btn active" data-mode="select">Select Gap</button>
        <button class="map-mode-btn" data-mode="draw">Draw Route</button>
      `
      document.getElementById('map').appendChild(modeBar)
      modeBar.querySelectorAll('.map-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          modeBar.querySelectorAll('.map-mode-btn').forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
        })
      })
    }

    if (!hint) {
      hint = document.createElement('div')
      hint.className = 'selection-hint'
      hint.innerHTML = `Click track to set <span class="hint-key">S</span> start and <span class="hint-key">E</span> end of broken segment`
      document.getElementById('map').appendChild(hint)
    }

    map.on('click', onMapClick)
  }

  function onMapClick(e) {
    const track = store.state.track
    if (!track) return
    const idx = nearestPointIndex(track, e.latlng)
    const pt = track.points[idx]
    const latlng = [pt.lat, pt.lng]

    if (!startMarker) {
      startIdx = idx
      startMarker = makeHandle(map, latlng, '#2563EB', 'S')
      startMarker.on('drag', ev => {
        startIdx = nearestPointIndex(track, ev.latlng)
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(notify, DEBOUNCE_MS)
      })
      hint.innerHTML = `Now click to set <span class="hint-key">E</span> end point`
    } else {
      endIdx = idx
      if (endMarker) map.removeLayer(endMarker)
      endMarker = makeHandle(map, latlng, '#EF4444', 'E')
      endMarker.on('drag', ev => {
        endIdx = nearestPointIndex(track, ev.latlng)
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(notify, DEBOUNCE_MS)
      })
      notify()
    }
  }

  function deactivate() {
    map.off('click', onMapClick)
    if (startMarker) { map.removeLayer(startMarker); startMarker = null }
    if (endMarker) { map.removeLayer(endMarker); endMarker = null }
    if (modeBar) { modeBar.remove(); modeBar = null }
    if (hint) { hint.remove(); hint = null }
    startIdx = null; endIdx = null
  }

  store.subscribe(state => {
    if (state.phase === 'LOADED') activate(state.track)
    if (state.phase === 'IDLE') deactivate()
  })

  return { deactivate }
}
```

- [ ] **Step 2: Update `src/main.js`** to wire selection

```js
// Add after initMap():
import { initSelection } from './map/selection.js'
import { fetchSuggestions } from './routing/suggestions.js'  // will be created in Task 7

// Add after initPanel():
initSelection(map, {
  onSegmentChange: async (startIdx, endIdx) => {
    store.setState({ phase: 'SEGMENT_SELECTED', segmentStart: startIdx, segmentEnd: endIdx })
    // Task 7 will wire fetchSuggestions here
  }
})
```

- [ ] **Step 3: Verify in browser**

Load a GPX, click track → blue S handle appears. Click again → red E handle appears. Both draggable.

- [ ] **Step 4: Commit**

```bash
git add src/map/selection.js src/main.js
git commit -m "feat: add segment selection with draggable S/E handles"
```

---

### Task 7: OSRM Routing + Suggestions

**Files:**
- Create: `src/routing/osrm.js`
- Create: `src/routing/suggestions.js`
- Create: `src/routing/osrm.test.js`

**Interfaces:**
- Consumes: `store.state.track.activityType`, start/end `Point` objects
- Produces:
  - `fetchOsrmRoutes(startPoint, endPoint, activityType): Promise<OsrmRoute[]>`
  - `OsrmRoute`: `{ geometry: { coordinates: [lng, lat][] }, distance: number, duration: number }`
  - `fetchSuggestions(track, startIdx, endIdx): Promise<Suggestion[]>`
  - `Suggestion`: `{ route: [lng, lat][], distance: number, matchScore: number, label: string }`

- [ ] **Step 1: Write failing tests for scoring**

```js
// src/routing/osrm.test.js
import { describe, it, expect } from 'vitest'
import { scoreRoute } from './osrm.js'

describe('scoreRoute', () => {
  it('returns 1.0 when suggested distance matches gap exactly', () => {
    expect(scoreRoute(1000, 1000)).toBe(1)
  })

  it('returns 0.5 when suggested distance is 50% longer', () => {
    expect(scoreRoute(1500, 1000)).toBeCloseTo(0.5, 5)
  })

  it('clamps to 0 for very different distances', () => {
    expect(scoreRoute(5000, 500)).toBe(0)
  })

  it('handles gapDist = 0 without throwing', () => {
    expect(() => scoreRoute(100, 0)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './osrm.js'`

- [ ] **Step 3: Implement `src/routing/osrm.js`**

```js
// src/routing/osrm.js
const BASE = 'https://router.project-osrm.org/route/v1'
const PROFILE_MAP = { cycling: 'cycling', running: 'foot' }

export function scoreRoute(suggestedDist, gapDist) {
  if (gapDist === 0) return 0
  return Math.max(0, 1 - Math.abs(suggestedDist - gapDist) / gapDist)
}

export async function fetchOsrmRoutes(startPoint, endPoint, activityType) {
  const profile = PROFILE_MAP[activityType] ?? 'cycling'
  const coord = `${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}`
  const url = `${BASE}/${profile}/${coord}?overview=full&geometries=geojson&alternatives=true`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`OSRM error: ${res.status}`)
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No road route found — try drawing manually')
  return data.routes
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: PASS (scoreRoute tests)

- [ ] **Step 5: Implement `src/routing/suggestions.js`**

```js
// src/routing/suggestions.js
import { fetchOsrmRoutes, scoreRoute } from './osrm.js'

export async function fetchSuggestions(track, startIdx, endIdx) {
  const startPoint = track.points[startIdx]
  const endPoint = track.points[endIdx]
  const gapDist = endPoint.distance - startPoint.distance

  const routes = await fetchOsrmRoutes(startPoint, endPoint, track.activityType)

  return routes.map((r, i) => ({
    route: r.geometry.coordinates,
    distance: r.distance,
    matchScore: scoreRoute(r.distance, gapDist),
    label: i === 0 ? 'Shortest Route' : i === 1 ? 'Alternative Route' : `Option ${i + 1}`,
  })).sort((a, b) => b.matchScore - a.matchScore)
}
```

- [ ] **Step 6: Wire into `src/main.js`** — update `onSegmentChange` handler

Replace the `onSegmentChange` callback in main.js:

```js
onSegmentChange: async (startIdx, endIdx) => {
  store.setState({ phase: 'FIXING', segmentStart: startIdx, segmentEnd: endIdx })
  try {
    const suggestions = await fetchSuggestions(store.state.track, startIdx, endIdx)
    const chosenRoute = suggestions[0]?.route ?? null
    store.setState({ phase: 'ROUTE_CHOSEN', suggestions, chosenRoute })
  } catch (e) {
    showToast(e.message)
    store.setState({ phase: 'LOADED', suggestions: [], chosenRoute: null })
  }
}
```

Add import at top:
```js
import { fetchSuggestions } from './routing/suggestions.js'
```

- [ ] **Step 7: Wire suggestion selection in panel**

Update `initPanel` call in main.js:

```js
import { addSuggestionLayer, removeSuggestionLayer } from './map/track-layer.js'

let suggestionLayer = null

initPanel({
  onChoose: (suggestion) => {
    if (suggestionLayer) removeSuggestionLayer(map, suggestionLayer)
    suggestionLayer = addSuggestionLayer(map, suggestion.route)
    store.setState({ chosenRoute: suggestion.route })
  },
  onDownload: () => {} // Task 8
})
```

- [ ] **Step 8: Verify end-to-end in browser**

Load GPX → click S on track → click E on broken segment → OSRM fires → suggestions appear in right panel → click suggestion → green route overlays map.

- [ ] **Step 9: Commit**

```bash
git add src/routing/
git commit -m "feat: add OSRM routing and suggestion scoring"
```

---

### Task 8: FIT File Writer + Export

**Files:**
- Create: `src/io/fit-writer.js`
- Create: `src/io/fit-writer.test.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes:
  - `store.state.track` (Track from Task 3)
  - `store.state.segmentStart`, `store.state.segmentEnd` (indices)
  - `store.state.chosenRoute` — GeoJSON `[lng, lat][]` array
- Produces:
  - `buildFixedTrack(track, startIdx, endIdx, routeCoords): Point[]` — returns full corrected points array
  - `writeFit(points, activityType): ArrayBuffer` — returns FIT binary
  - `downloadFit(arrayBuffer, filename)` — triggers browser download

- [ ] **Step 1: Write failing tests for `buildFixedTrack`**

```js
// src/io/fit-writer.test.js
import { describe, it, expect } from 'vitest'
import { buildFixedTrack } from './fit-writer.js'

const makePoint = (lat, lng, dist, ts, hr = 140) => ({
  lat, lng, ele: 100, timestamp: ts, hr, power: null, cadence: null, distance: dist
})

describe('buildFixedTrack', () => {
  it('preserves points before and after the segment', () => {
    const points = [
      makePoint(48.0, 16.0, 0, 1000),
      makePoint(48.1, 16.1, 1000, 2000),   // startIdx
      makePoint(48.3, 16.3, 3000, 3000),   // endIdx
      makePoint(48.4, 16.4, 4000, 4000),
    ]
    const track = { activityType: 'cycling', points, gaps: [] }
    // route: direct line from startPoint to endPoint with 2 intermediate coords
    const routeCoords = [[16.1, 48.1], [16.2, 48.2], [16.3, 48.3]]
    const result = buildFixedTrack(track, 1, 2, routeCoords)
    expect(result[0].lat).toBeCloseTo(48.0, 4)
    expect(result[result.length - 1].lat).toBeCloseTo(48.4, 4)
  })

  it('inserts interpolated points between start and end', () => {
    const points = [
      makePoint(48.0, 16.0, 0, 1000),
      makePoint(48.1, 16.1, 1000, 2000),
      makePoint(48.3, 16.3, 3000, 3000),
      makePoint(48.4, 16.4, 4000, 4000),
    ]
    const track = { activityType: 'cycling', points, gaps: [] }
    const routeCoords = [[16.1, 48.1], [16.15, 48.15], [16.2, 48.2], [16.25, 48.25], [16.3, 48.3]]
    const result = buildFixedTrack(track, 1, 2, routeCoords)
    expect(result.length).toBeGreaterThan(4)
  })

  it('flat-fills HR from average of last 5 points before gap', () => {
    const points = [
      makePoint(48.0, 16.0, 0, 1000, 130),
      makePoint(48.05, 16.05, 500, 1500, 135),
      makePoint(48.1, 16.1, 1000, 2000, 140),    // startIdx
      makePoint(48.3, 16.3, 3000, 3000, null),
      makePoint(48.4, 16.4, 4000, 4000, 150),
    ]
    const track = { activityType: 'cycling', points, gaps: [] }
    const routeCoords = [[16.1, 48.1], [16.2, 48.2], [16.3, 48.3]]
    const result = buildFixedTrack(track, 2, 3, routeCoords)
    const insertedPoints = result.slice(2, result.length - 1)
    const expectedHR = Math.round((130 + 135 + 140) / 3)
    insertedPoints.forEach(p => expect(p.hr).toBe(expectedHR))
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './fit-writer.js'`

- [ ] **Step 3: Implement `src/io/fit-writer.js`**

```js
// src/io/fit-writer.js

function haversineDistance(p1, p2) {
  const R = 6371000
  const lat1 = p1.lat * Math.PI / 180, lat2 = p2.lat * Math.PI / 180
  const dLat = (p2.lat - p1.lat) * Math.PI / 180
  const dLng = (p2.lng - p1.lng) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function sampleRouteAt10m(routeCoords) {
  // routeCoords: [lng, lat][] from OSRM
  const TARGET = 10 // metres
  const result = []
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const [lng1, lat1] = routeCoords[i]
    const [lng2, lat2] = routeCoords[i + 1]
    const segDist = haversineDistance({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 })
    const steps = Math.max(1, Math.round(segDist / TARGET))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      result.push({ lat: lat1 + (lat2 - lat1) * t, lng: lng1 + (lng2 - lng1) * t })
    }
  }
  const last = routeCoords[routeCoords.length - 1]
  result.push({ lat: last[1], lng: last[0] })
  return result
}

export function buildFixedTrack(track, startIdx, endIdx, routeCoords) {
  const { points } = track
  const before = points.slice(0, startIdx + 1)
  const after = points.slice(endIdx)

  // Average HR/power/cadence from last 5 points before gap
  const preGap = points.slice(Math.max(0, startIdx - 4), startIdx + 1)
  const avgHr = preGap.some(p => p.hr != null)
    ? Math.round(preGap.filter(p => p.hr != null).reduce((s, p) => s + p.hr, 0) / preGap.filter(p => p.hr != null).length)
    : null
  const avgPower = preGap.some(p => p.power != null)
    ? Math.round(preGap.filter(p => p.power != null).reduce((s, p) => s + p.power, 0) / preGap.filter(p => p.power != null).length)
    : null
  const avgCadence = preGap.some(p => p.cadence != null)
    ? Math.round(preGap.filter(p => p.cadence != null).reduce((s, p) => s + p.cadence, 0) / preGap.filter(p => p.cadence != null).length)
    : null

  const startPt = points[startIdx]
  const endPt = points[endIdx]
  const gapDuration = endPt.timestamp - startPt.timestamp
  const gapStartDist = startPt.distance

  const sampled = sampleRouteAt10m(routeCoords)
  // Compute cumulative distance along sampled route
  let cumulDist = 0
  const sampledWithDist = sampled.map((pt, i) => {
    if (i > 0) cumulDist += haversineDistance(sampled[i - 1], pt)
    return { ...pt, localDist: cumulDist }
  })
  const totalRouteDist = cumulDist || 1

  const inserted = sampledWithDist.map((pt, i) => {
    const frac = pt.localDist / totalRouteDist
    const ele = startPt.ele + (endPt.ele - startPt.ele) * frac
    const timestamp = startPt.timestamp + gapDuration * frac
    const distance = gapStartDist + pt.localDist
    return { lat: pt.lat, lng: pt.lng, ele, timestamp, hr: avgHr, power: avgPower, cadence: avgCadence, distance }
  })

  // Skip first inserted (= startIdx) and last inserted (= endIdx) — they duplicate before/after
  const middle = inserted.slice(1, -1)

  // Rebuild result and recalculate cumulative distance
  const combined = [...before, ...middle, ...after]
  let runDist = 0
  return combined.map((pt, i) => {
    if (i > 0) runDist += haversineDistance(combined[i - 1], pt)
    return { ...pt, distance: Math.round(runDist) }
  })
}

export function writeFit(points, activityType) {
  // Minimal FIT binary writer — records only the fields we need
  // FIT protocol: header (14 bytes) + record messages + CRC (2 bytes)
  // We write: file_id message, session message, lap message, N record messages

  const SPORT = activityType === 'running' ? 1 : 2
  const buf = new ArrayBuffer(16 * 1024 * 1024) // 16MB max
  const view = new DataView(buf)
  let offset = 14 // skip header, fill after

  function writeU8(v) { view.setUint8(offset++, v) }
  function writeU16(v) { view.setUint16(offset, v, true); offset += 2 }
  function writeU32(v) { view.setUint32(offset, v, true); offset += 4 }
  function writeI32(v) { view.setInt32(offset, v, true); offset += 4 }

  // Definition message for record (mesg_num=20)
  // Fields: timestamp(4), position_lat(4), position_long(4), altitude(2), distance(4), heart_rate(1), power(2), cadence(1)
  writeU8(0x40)    // definition header (local msg 0)
  writeU8(0x00)    // reserved
  writeU8(0x00)    // little-endian arch
  writeU16(20)     // global msg num: record
  writeU8(8)       // field count

  // field defs: [field_def_num, size, base_type]
  const fieldDefs = [
    [253, 4, 134], // timestamp: uint32
    [0,   4, 133], // position_lat: sint32
    [1,   4, 133], // position_long: sint32
    [2,   2, 132], // altitude: uint16 (m * 5 + 500)
    [5,   4, 134], // distance: uint32 (cm)
    [3,   1, 2],   // heart_rate: uint8
    [7,   2, 132], // power: uint16
    [4,   1, 2],   // cadence: uint8
  ]
  fieldDefs.forEach(([num, size, type]) => { writeU8(num); writeU8(size); writeU8(type) })

  const startTs = Math.round((points[0]?.timestamp ?? Date.now()) / 1000)
  const FIT_EPOCH = 631065600 // seconds between Unix epoch and FIT epoch (1989-12-31)

  // Write record messages
  points.forEach(pt => {
    writeU8(0x00) // data header local msg 0
    writeU32(Math.round(pt.timestamp / 1000) - FIT_EPOCH)
    writeI32(Math.round(pt.lat * (2 ** 31 / 180)))
    writeI32(Math.round(pt.lng * (2 ** 31 / 180)))
    writeU16(Math.round(pt.ele * 5 + 500))
    writeU32(Math.round(pt.distance * 100))
    writeU8(pt.hr ?? 0xFF)
    writeU16(pt.power ?? 0xFFFF)
    writeU8(pt.cadence ?? 0xFF)
  })

  const dataSize = offset - 14
  const totalSize = offset + 2

  // Write FIT file header (14 bytes)
  const headerView = new DataView(buf, 0, 14)
  headerView.setUint8(0, 14)              // header size
  headerView.setUint8(1, 0x10)            // protocol version 1.0
  headerView.setUint16(2, 2132, true)     // profile version
  headerView.setUint32(4, dataSize, true) // data size
  headerView.setUint8(8, 0x2E)           // '.FIT'
  headerView.setUint8(9, 0x46)
  headerView.setUint8(10, 0x49)
  headerView.setUint8(11, 0x54)

  // CRC16 (FIT checksum)
  function crc16(data, len) {
    const CRC_TABLE = [0x0000,0xCC01,0xD801,0x1400,0xF001,0x3C00,0x2800,0xE401,0xA001,0x6C00,0x7800,0xB401,0x5000,0x9C01,0x8801,0x4400]
    let crc = 0
    for (let i = 0; i < len; i++) {
      let tmp = CRC_TABLE[crc & 0x0F]
      crc = (crc >> 4) & 0x0FFF
      crc ^= tmp ^ CRC_TABLE[(data[i]) & 0x0F]
      tmp = CRC_TABLE[crc & 0x0F]
      crc = (crc >> 4) & 0x0FFF
      crc ^= tmp ^ CRC_TABLE[(data[i] >> 4) & 0x0F]
    }
    return crc
  }

  const dataBytes = new Uint8Array(buf, 0, offset)
  const crc = crc16(dataBytes, offset)
  view.setUint16(offset, crc, true)

  return buf.slice(0, totalSize)
}

export function downloadFit(arrayBuffer, filename) {
  const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 100)
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 5: Wire export into `src/main.js`**

Update import block and `onDownload` handler:

```js
import { buildFixedTrack, writeFit, downloadFit } from './io/fit-writer.js'

// Update initPanel call:
initPanel({
  onChoose: (suggestion) => {
    if (suggestionLayer) removeSuggestionLayer(map, suggestionLayer)
    suggestionLayer = addSuggestionLayer(map, suggestion.route)
    store.setState({ chosenRoute: suggestion.route })
  },
  onDownload: () => {
    const { track, segmentStart, segmentEnd, chosenRoute } = store.state
    if (!track || !chosenRoute) {
      showToast('No route chosen yet')
      return
    }
    try {
      const fixedPoints = buildFixedTrack(track, segmentStart, segmentEnd, chosenRoute)
      const fitBuffer = writeFit(fixedPoints, track.activityType)
      downloadFit(fitBuffer, `fixed-ride-${Date.now()}.fit`)
    } catch (e) {
      showToast('Export failed — check browser console for details')
      console.error(e)
    }
  }
})
```

- [ ] **Step 6: End-to-end test**

1. Load a GPX with a simulated gap (two points far apart within 5 minutes)
2. Click S on the track before the gap
3. Click E after the gap
4. Wait for route suggestions
5. Click "Download .fit"
6. Verify file downloads and is > 0 bytes

- [ ] **Step 7: Commit**

```bash
git add src/io/fit-writer.js src/io/fit-writer.test.js src/main.js
git commit -m "feat: add FIT writer and export flow"
```

---

### Task 9: Manual Draw Mode

**Files:**
- Create: `src/map/draw-mode.js`
- Modify: `src/map/selection.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: map instance, `store.state.segmentStart`, `store.state.segmentEnd`
- Produces:
  - `initDrawMode(map, { onRouteComplete })` — activates when "Draw Route" mode-bar button clicked; calls `onRouteComplete(coords)` with `[lng, lat][]` array

- [ ] **Step 1: Create `src/map/draw-mode.js`**

```js
// src/map/draw-mode.js
import L from 'leaflet'
import { store } from '../store.js'

export function initDrawMode(map, { onRouteComplete }) {
  let waypoints = []
  let waypointMarkers = []
  let previewLine = null
  let active = false

  const icon = L.divIcon({
    className: '',
    html: '<div style="width:10px;height:10px;border-radius:50%;background:#10B981;border:2px solid #fff;box-shadow:0 0 0 1px #10B981"></div>',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  })

  function onMapClick(e) {
    if (!active) return
    waypoints.push([e.latlng.lng, e.latlng.lat])
    const marker = L.marker(e.latlng, { icon }).addTo(map)
    waypointMarkers.push(marker)
    if (waypoints.length >= 2) {
      if (previewLine) map.removeLayer(previewLine)
      previewLine = L.polyline(waypoints.map(([lng, lat]) => [lat, lng]), {
        color: '#10B981', weight: 3, dashArray: '6 4',
      }).addTo(map)
    }
  }

  function finish() {
    if (waypoints.length < 2) return
    // Prepend start and append end from store
    const { track, segmentStart, segmentEnd } = store.state
    const start = track.points[segmentStart]
    const end = track.points[segmentEnd]
    const full = [
      [start.lng, start.lat],
      ...waypoints,
      [end.lng, end.lat],
    ]
    deactivate()
    onRouteComplete(full)
  }

  function deactivate() {
    active = false
    map.off('click', onMapClick)
    waypointMarkers.forEach(m => map.removeLayer(m))
    waypointMarkers = []
    waypoints = []
    if (previewLine) { map.removeLayer(previewLine); previewLine = null }
    finishBtn?.remove()
    finishBtn = null
  }

  let finishBtn = null

  function activate() {
    active = true
    waypoints = []
    waypointMarkers.forEach(m => map.removeLayer(m))
    waypointMarkers = []
    if (previewLine) { map.removeLayer(previewLine); previewLine = null }
    map.on('click', onMapClick)

    finishBtn = document.createElement('button')
    finishBtn.className = 'btn btn-success'
    finishBtn.style.cssText = 'position:absolute;bottom:60px;right:14px;z-index:1000'
    finishBtn.textContent = 'Finish Route'
    finishBtn.addEventListener('click', finish)
    document.getElementById('map').appendChild(finishBtn)
  }

  return { activate, deactivate }
}
```

- [ ] **Step 2: Wire draw mode into `src/main.js`**

```js
import { initDrawMode } from './map/draw-mode.js'
import { addSuggestionLayer, removeSuggestionLayer } from './map/track-layer.js'

let drawMode = null
let suggestionLayer = null

// After initMap():
drawMode = initDrawMode(map, {
  onRouteComplete: (coords) => {
    if (suggestionLayer) removeSuggestionLayer(map, suggestionLayer)
    suggestionLayer = addSuggestionLayer(map, coords)
    const manualSuggestion = { route: coords, distance: 0, matchScore: 1, label: 'Manual Route' }
    const existing = store.state.suggestions
    store.setState({
      phase: 'ROUTE_CHOSEN',
      suggestions: [manualSuggestion, ...existing.filter(s => s.label !== 'Manual Route')],
      chosenRoute: coords,
    })
  }
})
```

- [ ] **Step 3: Wire mode-bar buttons in `src/map/selection.js`**

Update the modeBar button handler to call draw mode activate/deactivate:

In `activate()`, pass `drawMode` from main via a callback. Update `initSelection` signature:

```js
// src/map/selection.js — updated signature
export function initSelection(map, { onSegmentChange, onDrawModeToggle }) {
  // ...
  // In modeBar button click handler:
  modeBar.querySelectorAll('.map-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modeBar.querySelectorAll('.map-mode-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      onDrawModeToggle(btn.dataset.mode === 'draw')
    })
  })
}
```

Update call in main.js:

```js
initSelection(map, {
  onSegmentChange: async (startIdx, endIdx) => { /* same as before */ },
  onDrawModeToggle: (entering) => {
    if (entering) drawMode.activate()
    else drawMode.deactivate()
  }
})
```

- [ ] **Step 4: Verify in browser**

After placing S/E handles: click "Draw Route" in mode bar → click waypoints on map → "Finish Route" button → green route renders → appears as top suggestion in right panel.

- [ ] **Step 5: Commit**

```bash
git add src/map/draw-mode.js src/map/selection.js src/main.js
git commit -m "feat: add manual draw mode for custom route waypoints"
```

---

### Task 10: Error Handling + Polish

**Files:**
- Modify: `src/main.js`
- Modify: `src/routing/suggestions.js`
- Modify: `src/map/selection.js`

**Interfaces:** No new exports — hardening existing behavior.

- [ ] **Step 1: Handle OSRM unreachable in `src/routing/suggestions.js`**

Wrap the fetch in a try/catch that distinguishes network error from API error:

```js
// src/routing/suggestions.js
export async function fetchSuggestions(track, startIdx, endIdx) {
  const startPoint = track.points[startIdx]
  const endPoint = track.points[endIdx]
  const gapDist = endPoint.distance - startPoint.distance

  let routes
  try {
    routes = await fetchOsrmRoutes(startPoint, endPoint, track.activityType)
  } catch (e) {
    if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
      throw new Error('OSRM routing unavailable — check your connection or draw the route manually')
    }
    throw e
  }

  return routes.map((r, i) => ({
    route: r.geometry.coordinates,
    distance: r.distance,
    matchScore: scoreRoute(r.distance, gapDist),
    label: i === 0 ? 'Shortest Route' : i === 1 ? 'Alternative Route' : `Option ${i + 1}`,
  })).sort((a, b) => b.matchScore - a.matchScore)
}
```

- [ ] **Step 2: Show manual draw mode automatically when OSRM fails**

In `src/main.js`, update the catch block of `onSegmentChange`:

```js
onSegmentChange: async (startIdx, endIdx) => {
  store.setState({ phase: 'FIXING', segmentStart: startIdx, segmentEnd: endIdx })
  try {
    const suggestions = await fetchSuggestions(store.state.track, startIdx, endIdx)
    const chosenRoute = suggestions[0]?.route ?? null
    store.setState({ phase: 'ROUTE_CHOSEN', suggestions, chosenRoute })
  } catch (e) {
    showToast(e.message, 'warning')
    // Still advance to ROUTE_CHOSEN with empty suggestions so user can draw manually
    store.setState({ phase: 'ROUTE_CHOSEN', suggestions: [], chosenRoute: null })
  }
}
```

- [ ] **Step 3: Add loading spinner during FIXING phase**

In `src/ui/panel.js`, update the FIXING phase branch:

```js
if (state.phase === 'SEGMENT_SELECTED' || state.phase === 'FIXING') {
  el.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Route Suggestions</div>
        <div class="panel-subtitle">Fetching routes…</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;flex:1;padding:40px;flex-direction:column;gap:12px">
      <div class="spinner"></div>
      <div style="font-size:12px;color:var(--text-3)">Querying OSRM…</div>
    </div>
  `
  return
}
```

Add spinner CSS to `src/style.css`:

```css
.spinner { width: 28px; height: 28px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation: none; border-top-color: var(--accent); } }
```

- [ ] **Step 4: Verify all error states in browser**

- Drop a non-.fit/.gpx file → toast: "Only .fit and .gpx files are supported"
- Create a GPX with no `<trkpt>` elements → toast: "No GPS data found in this file"
- Disconnect network → place S/E → toast about OSRM + manual draw available
- Place S/E very close together (< 50m) → warning toast

- [ ] **Step 5: Final build check**

```bash
npm run build
```

Expected: `dist/` folder created, no errors.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete Fix My Ride — error handling and build"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Parse .fit files | Task 3 |
| Parse .gpx files | Task 3 |
| Map with full track | Task 5 |
| Broken gap detection | Task 3 |
| Click S/E segment selection | Task 6 |
| Draggable handles | Task 6 |
| OSRM route suggestions (cycling + running) | Task 7 |
| Up to 3 suggestions with matchScore | Task 7 |
| Manual draw mode | Task 9 |
| FIT file generation | Task 8 |
| Interpolated timestamps | Task 8 |
| HR/power flat-fill from pre-gap average | Task 8 |
| Download .fit | Task 8 |
| Error: unsupported format | Task 10 |
| Error: no GPS data | Task 3 (thrown), Task 4 (caught) |
| Error: OSRM unreachable → manual draw | Task 10 |
| Error: no route found | Task 7 |
| Error: gap < 50m warning | Task 6 |
| Dark/light theme | Task 4 (CSS vars + toggle) |
| Step indicator | Task 4 |
| Recent activity list | Task 4 |

All spec requirements covered. No gaps found.

**Type consistency check:**

- `Track` type defined in Task 3, consumed identically in Tasks 5, 6, 7, 8, 9 ✓
- `Suggestion.route` is `[lng, lat][]` — used consistently in Task 7 (produces), Task 8 (`buildFixedTrack` consumes), Task 9 (draw mode produces) ✓
- `store.state.segmentStart/segmentEnd` are point indices — used consistently in Tasks 6, 7, 8, 9 ✓
- `addSuggestionLayer(map, coords)` takes `[lng, lat][]` — called in Tasks 7 and 9 ✓
