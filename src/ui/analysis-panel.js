// src/ui/analysis-panel.js
import { store } from '../store.js'

let _unsubscribe = null

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

function renderChart(label, unit, values, colorVar) {
  const { path, min, max } = buildPath(values, CHART_W, CHART_H)
  if (!path) return ''
  return `
    <div class="chart-row">
      <div class="chart-row-header">
        <span class="chart-row-label">${label}</span>
        <span class="chart-row-range">${min.toFixed(0)}–${max.toFixed(0)} ${unit}</span>
      </div>
      <svg class="chart-svg" viewBox="0 0 ${CHART_W} ${CHART_H}" preserveAspectRatio="none">
        <path d="${path}" fill="none" stroke="${colorVar}" stroke-width="2" vector-effect="non-scaling-stroke" />
      </svg>
    </div>
  `
}

export function initAnalysisPanel() {
  const el = document.getElementById('analysis-panel')

  if (_unsubscribe) _unsubscribe()
  _unsubscribe = store.subscribe(state => {
    if (state.phase !== 'FIXED' && state.phase !== 'EXPORTED') {
      el.className = ''
      el.innerHTML = ''
      return
    }

    const points = state.fixedPoints ?? []
    if (points.length < 2) { el.className = ''; el.innerHTML = ''; return }

    el.className = 'analysis-panel-open'

    const ele = points.map(p => p.ele)
    const hr = points.map(p => p.hr)
    const power = points.map(p => p.power)
    const speed = computeSpeed(points)

    const hasHr = hr.some(v => v != null)
    const hasPower = power.some(v => v != null)

    el.innerHTML = `
      <div class="chart-row-x-label">
        <span>0 km</span>
        <span>${((points[points.length - 1].distance) / 1000).toFixed(1)} km</span>
      </div>
      ${renderChart('Elevation', 'm', ele, '#94A3B8')}
      ${renderChart('Speed', 'km/h', speed, '#2563EB')}
      ${hasHr ? renderChart('Heart rate', 'bpm', hr, '#EF4444') : ''}
      ${hasPower ? renderChart('Power', 'W', power, '#F59E0B') : ''}
    `
  })
}
