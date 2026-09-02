// src/ui/sidebar.js
import { store } from '../store.js'

let _unsubscribe = null

export function initSidebar({ onFitFile, onGpxFile, onAutoFix, onStravaLogin, onPickStravaActivity, onPickStravaRoute, onChangeFit, onChangeGpx, onDrawRoute }) {
  const el = document.getElementById('sidebar')
  el.classList.add('sidebar')

  const handlers = { onFitFile, onGpxFile, onAutoFix, onStravaLogin, onPickStravaActivity, onPickStravaRoute, onChangeFit, onChangeGpx, onDrawRoute }
  renderSidebar(el, handlers, store.state)

  if (_unsubscribe) _unsubscribe()
  _unsubscribe = store.subscribe(state => {
    renderSidebar(el, handlers, state)
  })
}

function trackSummary(track, label, colorClass, changeBtnId) {
  const totalDist = track.points[track.points.length - 1]?.distance ?? 0
  return `
    <div class="track-summary">
      <div class="track-summary-header">
        <div class="track-summary-label ${colorClass}">${label}</div>
        ${changeBtnId ? `<button class="dual-upload-change" id="${changeBtnId}">Change</button>` : ''}
      </div>
      <div class="track-meta">
        <div class="track-meta-row"><span class="track-meta-key">Distance</span><span class="track-meta-val">${(totalDist / 1000).toFixed(1)} km</span></div>
        <div class="track-meta-row"><span class="track-meta-key">Points</span><span class="track-meta-val">${track.points.length}</span></div>
      </div>
    </div>
  `
}

function stravaConnectRow(state, slot, label) {
  if (!state.stravaAuth) {
    return `<button class="strava-connect-btn" data-action="strava-login" data-slot="${slot}">
      <span class="strava-dot"></span>Connect Strava to pick ${label}
    </button>`
  }
  return `<button class="strava-connect-btn strava-connect-btn-active" data-action="strava-pick" data-slot="${slot}">
    <span class="strava-dot"></span>Choose ${label} from Strava
  </button>`
}

function renderSidebar(el, handlers, state) {
  const { onFitFile, onGpxFile, onAutoFix, onStravaLogin, onPickStravaActivity, onPickStravaRoute, onChangeFit, onChangeGpx, onDrawRoute } = handlers

  if (state.phase === 'IDLE' || state.phase === 'FIT_LOADED') {
    const fit = state.fitTrack
    el.innerHTML = `
      <div class="upload-page">
        <div class="upload-hero-row">
          <div class="upload-hero-icon">📍</div>
          ${state.visitorCity ? `<div class="visitor-city">${state.visitorCity}</div>` : ''}
        </div>
        <div class="upload-page-title">Fix broken GPS<br>with a reference route</div>
        <div class="upload-page-sub">Upload your broken activity, then a clean route to fix it against</div>

        <div class="dual-upload-track">
          <div class="dual-upload-step ${fit ? 'step-complete' : 'step-active'}">
            <div class="dual-upload-rail">
              <div class="dual-upload-num">${fit ? '✓' : '1'}</div>
              <div class="dual-upload-line ${fit ? 'line-complete' : ''}"></div>
            </div>
            <div class="dual-upload-body">
              <div class="dual-upload-title">Broken activity</div>
              ${fit ? `
                <div class="dual-upload-done">
                  <span class="dual-upload-done-icon">✓</span>
                  ${fit.points.length.toLocaleString()} points · ${(((fit.points[fit.points.length-1]?.distance ?? 0))/1000).toFixed(1)} km
                  <button class="dual-upload-change" id="btn-change-fit">Change</button>
                  <button class="dual-upload-discard" id="btn-discard">Discard</button>
                </div>
              ` : `
                <div class="upload-zone" id="upload-zone-fit">
                  <div class="upload-icon">🚴</div>
                  <div class="upload-cta">Drop <strong>.fit</strong> here or <span class="upload-link">browse</span></div>
                  <div class="upload-formats">Your recorded activity, gaps and all</div>
                  <input type="file" id="file-input-fit" accept=".fit" style="display:none" />
                </div>
                <div class="upload-or">or</div>
                ${stravaConnectRow(state, 'activity', 'an activity')}
              `}
            </div>
          </div>

          <div class="dual-upload-step ${!fit ? 'step-disabled' : 'step-active'}">
            <div class="dual-upload-rail">
              <div class="dual-upload-num">2</div>
            </div>
            <div class="dual-upload-body">
              <div class="dual-upload-title">Reference route</div>
              ${fit ? `
                <div class="upload-zone" id="upload-zone-gpx">
                  <div class="upload-icon">🗺️</div>
                  <div class="upload-cta">Drop <strong>.gpx</strong> here or <span class="upload-link">browse</span></div>
                  <div class="upload-formats">A clean route covering the same path</div>
                  <input type="file" id="file-input-gpx" accept=".gpx" style="display:none" />
                </div>
                <div class="upload-or">or</div>
                ${stravaConnectRow(state, 'route', 'a saved route')}
                <div class="upload-or">or</div>
                <button class="strava-connect-btn" id="btn-draw-route">🖊️ Draw a route on the map</button>
              ` : `
                <div class="upload-hint-disabled">Add the broken activity first</div>
              `}
            </div>
          </div>
        </div>
      </div>
    `
    _bindZone(el, 'upload-zone-fit', 'file-input-fit', onFitFile)
    _bindZone(el, 'upload-zone-gpx', 'file-input-gpx', onGpxFile)
    el.querySelectorAll('[data-action="strava-login"]').forEach(btn => btn.addEventListener('click', onStravaLogin))
    el.querySelector('[data-action="strava-pick"][data-slot="activity"]')?.addEventListener('click', onPickStravaActivity)
    el.querySelector('[data-action="strava-pick"][data-slot="route"]')?.addEventListener('click', onPickStravaRoute)
    el.querySelector('#btn-draw-route')?.addEventListener('click', onDrawRoute)
    el.querySelector('#btn-change-fit')?.addEventListener('click', onChangeFit)
    el.querySelector('#btn-discard')?.addEventListener('click', () => store.reset())
    return
  }

  if (state.phase === 'BOTH_LOADED' && state.fitTrack && state.gpxTrack) {
    el.innerHTML = `
      <div class="sidebar-section border-b">${trackSummary(state.fitTrack, 'FIT (broken)', 'label-blue', 'btn-change-fit')}</div>
      <div class="sidebar-section border-b">${trackSummary(state.gpxTrack, 'GPX (reference)', 'label-red', 'btn-change-gpx')}</div>
      <div class="sidebar-section">
        <div class="sidebar-label">Fix Route</div>
        <div class="gap-hint">
          <span class="gap-hint-icon">ℹ</span>
          Replaces the whole path with the GPX route, keeping your recorded time/HR/power/cadence
        </div>
        <button class="btn btn-primary" id="btn-auto-fix" style="width:100%;margin-top:12px">Fix using GPX →</button>
        <button class="btn btn-ghost" id="btn-discard" style="width:100%;margin-top:8px">Discard</button>
      </div>
    `
    el.querySelector('#btn-auto-fix')?.addEventListener('click', () => onAutoFix())
    el.querySelector('#btn-change-fit')?.addEventListener('click', onChangeFit)
    el.querySelector('#btn-change-gpx')?.addEventListener('click', onChangeGpx)
    el.querySelector('#btn-discard')?.addEventListener('click', () => store.reset())
    return
  }

  if (state.phase === 'FIXING') {
    el.innerHTML = `
      <div class="sidebar-section">
        <div class="sidebar-label">Rebuilding Route</div>
        <div style="display:flex;align-items:center;gap:10px;padding:16px 0">
          <div class="spinner"></div>
          <div style="font-size:12px;color:var(--text-3)">Mapping your ride onto the GPX path…</div>
        </div>
      </div>
    `
    return
  }

  if ((state.phase === 'FIXED' || state.phase === 'EXPORTED') && state.fitTrack) {
    const fixedDist = state.fixedPoints?.[state.fixedPoints.length - 1]?.distance ?? 0
    el.innerHTML = `
      <div class="sidebar-section border-b">${trackSummary(state.fitTrack, 'FIT (broken)', 'label-blue', 'btn-change-fit')}</div>
      <div class="sidebar-section border-b">${trackSummary(state.gpxTrack, 'GPX (reference)', 'label-red', 'btn-change-gpx')}</div>
      <div class="sidebar-section">
        <div class="sidebar-label">Fix Result</div>
        <div class="track-meta-row"><span class="track-meta-key">Fixed points</span><span class="track-meta-val val-ok">${state.fixedPoints?.length ?? 0}</span></div>
        <div class="track-meta-row"><span class="track-meta-key">Distance</span><span class="track-meta-val">${(fixedDist / 1000).toFixed(1)} km</span></div>
        <button class="btn btn-ghost" id="btn-reselect" style="margin-top:10px;width:100%">← Start over</button>
      </div>
    `
    el.querySelector('#btn-reselect')?.addEventListener('click', () => store.reset())
    el.querySelector('#btn-change-fit')?.addEventListener('click', onChangeFit)
    el.querySelector('#btn-change-gpx')?.addEventListener('click', onChangeGpx)
    return
  }

  el.innerHTML = ''
}

function _bindZone(el, zoneId, inputId, onFile) {
  const zone = el.querySelector(`#${zoneId}`)
  const input = el.querySelector(`#${inputId}`)
  if (!zone || !input) return

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
}
