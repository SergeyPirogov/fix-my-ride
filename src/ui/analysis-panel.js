// src/ui/analysis-panel.js
import { store } from '../store.js'

let _unsubscribe = null
let _pointerBound = false

const CHART_W = 1000 // viewBox width — scales to container via CSS
const CHART_H = 60

function buildPath(values, w, h, pad = 2) {
  const valid = values.map((v, i) => ({ v, i })).filter(p => p.v != null)
  if (valid.length < 2) return { path: '', min: 0, max: 0 }
  const min = Math.min(...valid.map(p => p.v))
  const max = Math.max(...valid.map(p => p.v))
  const range = max - min || 1
  const n = values.length - 1
  const points = valid.map(({ v, i }) => {
    const x = (i / n) * w
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return [x, y]
  })
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return { path, min, max }
}

// Adjacent resampled points can land extremely close in time when the
// underlying fit distance/time curve is compressed (e.g. near a very short
// span in the original recording), producing a momentary speed spike that's
// a display artifact rather than a real pace change — clamp to a sane
// ceiling so one bad sample doesn't blow out the chart's whole y-axis.
const MAX_PLAUSIBLE_SPEED_KMH = 90

function computeSpeed(points) {
  const speeds = [null]
  for (let i = 1; i < points.length; i++) {
    const dDist = points[i].distance - points[i - 1].distance
    const dTime = (points[i].timestamp - points[i - 1].timestamp) / 1000
    const kmh = dTime > 0 ? (dDist / dTime) * 3.6 : null
    speeds.push(kmh != null && kmh <= MAX_PLAUSIBLE_SPEED_KMH ? kmh : null)
  }
  return speeds
}

function renderChart(key, label, unit, values, colorVar) {
  const { path, min, max } = buildPath(values, CHART_W, CHART_H)
  if (!path) return ''
  return `
    <div class="chart-row" data-chart="${key}">
      <div class="chart-row-header">
        <span class="chart-row-label">${label}</span>
        <span class="chart-row-range" data-role="range">${min.toFixed(0)}–${max.toFixed(0)} ${unit}</span>
      </div>
      <div class="chart-svg-wrap">
        <svg class="chart-svg" viewBox="0 0 ${CHART_W} ${CHART_H}" preserveAspectRatio="none">
          <path d="${path}" fill="none" stroke="${colorVar}" stroke-width="2" vector-effect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
  `
}

function fmtVal(v, unit, decimals = 0) {
  return v == null ? '—' : `${v.toFixed(decimals)} ${unit}`
}

export function initAnalysisPanel({ onScrub, onScrubEnd } = {}) {
  const el = document.getElementById('analysis-panel')

  if (_unsubscribe) _unsubscribe()
  _unsubscribe = store.subscribe(state => {
    const showsFixedTrack = state.phase === 'FIXED' || state.phase === 'EXPORTED'
    // Before a fix exists, show the broken track's own recorded data so the
    // user can see what they're working with (gaps and all) — same charts,
    // just sourced from fitTrack instead of the corrected fixedPoints.
    const points = showsFixedTrack ? (state.fixedPoints ?? []) : (state.fitTrack?.points ?? [])
    if (points.length < 2) { el.className = ''; el.innerHTML = ''; return }

    el.className = 'analysis-panel-open'

    const ele = points.map(p => p.ele)
    const hr = points.map(p => p.hr)
    const power = points.map(p => p.power)
    const speed = computeSpeed(points)

    const hasHr = hr.some(v => v != null)
    const hasPower = power.some(v => v != null)
    const totalDistKm = points[points.length - 1].distance / 1000

    el.innerHTML = `
      <div class="chart-readout-bar" id="chart-readout-bar">
        <div class="readout-item" data-role="dist"><span class="readout-label">Distance</span><span class="readout-val" id="readout-dist">0.0 km</span></div>
        <div class="readout-item"><span class="readout-dot" style="background:#94A3B8"></span><span class="readout-label">Elevation</span><span class="readout-val" id="readout-ele">${fmtVal(ele[0], 'm')}</span></div>
        <div class="readout-item"><span class="readout-dot" style="background:#2563EB"></span><span class="readout-label">Speed</span><span class="readout-val" id="readout-speed">${fmtVal(speed[0], 'km/h', 1)}</span></div>
        ${hasHr ? `<div class="readout-item"><span class="readout-dot" style="background:#EF4444"></span><span class="readout-label">HR</span><span class="readout-val" id="readout-hr">${fmtVal(hr[0], 'bpm')}</span></div>` : ''}
        ${hasPower ? `<div class="readout-item"><span class="readout-dot" style="background:#F59E0B"></span><span class="readout-label">Power</span><span class="readout-val" id="readout-power">${fmtVal(power[0], 'W')}</span></div>` : ''}
      </div>
      <div class="chart-row-x-label">
        <span>0 km</span>
        <span>${totalDistKm.toFixed(1)} km</span>
      </div>
      <div class="chart-scrub-area" id="chart-scrub-area">
        ${renderChart('ele', 'Elevation', 'm', ele, '#94A3B8')}
        ${renderChart('speed', 'Speed', 'km/h', speed, '#2563EB')}
        ${hasHr ? renderChart('hr', 'Heart rate', 'bpm', hr, '#EF4444') : ''}
        ${hasPower ? renderChart('power', 'Power', 'W', power, '#F59E0B') : ''}
        <div class="chart-crosshair" id="chart-crosshair"></div>
      </div>
    `

    bindScrub(el, points, { ele, speed, hr, power }, onScrub, onScrubEnd)
  })
}

function bindScrub(root, points, series, onScrub, onScrubEnd) {
  const area = root.querySelector('#chart-scrub-area')
  const crosshair = root.querySelector('#chart-crosshair')
  const readoutDist = root.querySelector('#readout-dist')
  const readoutEle = root.querySelector('#readout-ele')
  const readoutSpeed = root.querySelector('#readout-speed')
  const readoutHr = root.querySelector('#readout-hr')
  const readoutPower = root.querySelector('#readout-power')
  if (!area) return

  function update(clientX) {
    const rect = area.getBoundingClientRect()
    let frac = (clientX - rect.left) / rect.width
    frac = Math.max(0, Math.min(1, frac))
    const idx = Math.round(frac * (points.length - 1))

    crosshair.style.left = `${frac * 100}%`
    crosshair.style.display = 'block'

    readoutDist.textContent = `${(points[idx].distance / 1000).toFixed(2)} km`
    readoutEle.textContent = fmtVal(series.ele[idx], 'm')
    readoutSpeed.textContent = fmtVal(series.speed[idx], 'km/h', 1)
    if (readoutHr) readoutHr.textContent = fmtVal(series.hr[idx], 'bpm')
    if (readoutPower) readoutPower.textContent = fmtVal(series.power[idx], 'W')

    // Before a fix exists, a scrubbed point can land in a GPS dropout
    // (null lat/lng, kept for its HR/power data) — skip the map marker then
    // rather than passing it a null coordinate.
    if (points[idx].lat != null && points[idx].lng != null) {
      onScrub?.({ lat: points[idx].lat, lng: points[idx].lng })
    } else {
      onScrubEnd?.()
    }
  }

  function hide() {
    crosshair.style.display = 'none'
    onScrubEnd?.()
  }

  area.addEventListener('mousemove', e => update(e.clientX))
  area.addEventListener('mouseleave', hide)
  area.addEventListener('touchstart', e => { update(e.touches[0].clientX); e.preventDefault() }, { passive: false })
  area.addEventListener('touchmove', e => { update(e.touches[0].clientX); e.preventDefault() }, { passive: false })
  area.addEventListener('touchend', hide)
}
