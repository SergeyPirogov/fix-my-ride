// src/ui/sidebar.js
import { store } from '../store.js'

let _unsubscribe = null

export function initSidebar({ onFitFile, onGpxFile, onAutoFix }) {
  const el = document.getElementById('sidebar')
  el.className = 'sidebar'

  renderSidebar(el, onFitFile, onGpxFile, onAutoFix, store.state)

  if (_unsubscribe) _unsubscribe()
  _unsubscribe = store.subscribe(state => {
    renderSidebar(el, onFitFile, onGpxFile, onAutoFix, state)
  })
}

function trackSummary(track, label, colorClass) {
  const totalDist = track.points[track.points.length - 1]?.distance ?? 0
  return `
    <div class="track-summary">
      <div class="track-summary-label ${colorClass}">${label}</div>
      <div class="track-meta">
        <div class="track-meta-row"><span class="track-meta-key">Distance</span><span class="track-meta-val">${(totalDist / 1000).toFixed(1)} km</span></div>
        <div class="track-meta-row"><span class="track-meta-key">Points</span><span class="track-meta-val">${track.points.length}</span></div>
      </div>
    </div>
  `
}

function renderSidebar(el, onFitFile, onGpxFile, onAutoFix, state) {
  if (state.phase === 'IDLE' || state.phase === 'FIT_LOADED') {
    const fit = state.fitTrack
    el.innerHTML = `
      <div class="upload-page">
        <div class="upload-page-title">Fix broken GPS with a reference route</div>
        <div class="upload-page-sub">Upload your broken activity, then a reference route to fix it against</div>

        <div class="dual-upload-step ${fit ? 'step-complete' : 'step-active'}">
          <div class="dual-upload-num">${fit ? '✓' : '1'}</div>
          <div class="dual-upload-body">
            <div class="dual-upload-title">Broken .fit file</div>
            ${fit ? `
              <div class="dual-upload-done">${fit.points.length} points · ${(((fit.points[fit.points.length-1]?.distance ?? 0))/1000).toFixed(1)} km</div>
            ` : `
              <div class="upload-zone" id="upload-zone-fit">
                <div class="upload-icon">📂</div>
                <div class="upload-text">Drop <strong>.fit</strong> here or click to browse</div>
                <input type="file" id="file-input-fit" accept=".fit" style="display:none" />
              </div>
            `}
          </div>
        </div>

        <div class="dual-upload-step ${!fit ? 'step-disabled' : 'step-active'}">
          <div class="dual-upload-num">2</div>
          <div class="dual-upload-body">
            <div class="dual-upload-title">Reference .gpx route</div>
            ${fit ? `
              <div class="upload-zone" id="upload-zone-gpx">
                <div class="upload-icon">📂</div>
                <div class="upload-text">Drop <strong>.gpx</strong> here or click to browse</div>
                <input type="file" id="file-input-gpx" accept=".gpx" style="display:none" />
              </div>
            ` : `
              <div class="upload-hint-disabled">Upload the broken .fit file first</div>
            `}
          </div>
        </div>
      </div>
    `
    _bindZone(el, 'upload-zone-fit', 'file-input-fit', onFitFile)
    _bindZone(el, 'upload-zone-gpx', 'file-input-gpx', onGpxFile)
    return
  }

  if (state.phase === 'BOTH_LOADED' && state.fitTrack && state.gpxTrack) {
    el.innerHTML = `
      <div class="sidebar-section border-b">${trackSummary(state.fitTrack, 'FIT (broken)', 'label-blue')}</div>
      <div class="sidebar-section border-b">${trackSummary(state.gpxTrack, 'GPX (reference)', 'label-red')}</div>
      <div class="sidebar-section">
        <div class="sidebar-label">Fix Route</div>
        <div class="gap-hint">
          <span class="gap-hint-icon">ℹ</span>
          Replaces the whole path with the GPX route, keeping your recorded time/HR/power/cadence
        </div>
        <button class="btn btn-primary" id="btn-auto-fix" style="width:100%;margin-top:12px">Fix using GPX →</button>
      </div>
    `
    el.querySelector('#btn-auto-fix')?.addEventListener('click', () => onAutoFix())
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
      <div class="sidebar-section border-b">${trackSummary(state.fitTrack, 'FIT (broken)', 'label-blue')}</div>
      <div class="sidebar-section border-b">${trackSummary(state.gpxTrack, 'GPX (reference)', 'label-red')}</div>
      <div class="sidebar-section">
        <div class="sidebar-label">Fix Result</div>
        <div class="track-meta-row"><span class="track-meta-key">Fixed points</span><span class="track-meta-val val-ok">${state.fixedPoints?.length ?? 0}</span></div>
        <div class="track-meta-row"><span class="track-meta-key">Distance</span><span class="track-meta-val">${(fixedDist / 1000).toFixed(1)} km</span></div>
        <button class="btn btn-ghost" id="btn-reselect" style="margin-top:10px;width:100%">← Start over</button>
      </div>
    `
    el.querySelector('#btn-reselect')?.addEventListener('click', () => store.reset())
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
