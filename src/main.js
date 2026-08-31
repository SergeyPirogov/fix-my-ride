// src/main.js
import './style.css'
import { store } from './store.js'
import { initTopbar } from './ui/topbar.js'
import { initSidebar } from './ui/sidebar.js'
import { initPanel, showToast } from './ui/panel.js'
import { parseFit } from './io/fit-parser.js'
import { parseGpx } from './io/gpx-parser.js'
import { initMap } from './map/map.js'
import { renderFitTrack, renderGpxTrack, renderFixedTrack, clearAll } from './map/track-layer.js'
import { matchAllGaps } from './routing/gpx-match.js'
import { buildFixedTrack, writeFit, downloadFit } from './io/fit-writer.js'

async function handleFitFile(file) {
  if (!file.name.toLowerCase().endsWith('.fit')) {
    showToast('Please upload a .fit file for the broken activity')
    return
  }
  try {
    const buf = await file.arrayBuffer()
    const fitTrack = await parseFit(buf)
    store.setState({ phase: 'FIT_LOADED', fitTrack })
  } catch (e) {
    showToast(e.message || 'Failed to parse .fit file')
  }
}

async function handleGpxFile(file) {
  if (!file.name.toLowerCase().endsWith('.gpx')) {
    showToast('Please upload a .gpx file for the reference route')
    return
  }
  try {
    const text = await file.text()
    const gpxTrack = parseGpx(text)
    store.setState({ phase: 'BOTH_LOADED', gpxTrack })
  } catch (e) {
    showToast(e.message || 'Failed to parse .gpx file')
  }
}

async function doAutoFix() {
  const { fitTrack, gpxTrack } = store.state
  if (!fitTrack || !gpxTrack) return
  store.setState({ phase: 'FIXING' })

  if (fitTrack.gaps.length === 0) {
    store.setState({ phase: 'FIXED', fixes: [], fixedPoints: fitTrack.points })
    return
  }

  const fixes = matchAllGaps(fitTrack, gpxTrack)
  const fixedPoints = buildFixedTrack(fitTrack, fixes)
  store.setState({ phase: 'FIXED', fixes, fixedPoints })

  const failCount = fixes.filter(f => f.status === 'failed').length
  if (failCount > 0) {
    showToast(`${failCount} gap${failCount > 1 ? 's' : ''} had no nearby GPX match`, 'warning')
  }
}

const map = initMap()

initTopbar()
initSidebar({ onFitFile: handleFitFile, onGpxFile: handleGpxFile, onAutoFix: doAutoFix })
initPanel({
  onDownload: () => {
    const { fitTrack, fixedPoints } = store.state
    if (!fitTrack || !fixedPoints) { showToast('No fixed track to export — click Fix using GPX first'); return }
    try {
      const fitBuffer = writeFit(fixedPoints, fitTrack.activityType)
      downloadFit(fitBuffer, `fixed-ride-${Date.now()}.fit`)
      store.setState({ phase: 'EXPORTED' })
    } catch (e) {
      showToast('Export failed — check browser console')
      console.error(e)
    }
  }
})

let _lastFit = null
let _lastGpx = null
let _lastFixedPoints = null
store.subscribe(state => {
  if (state.phase === 'IDLE') { clearAll(map); _lastFit = null; _lastGpx = null; _lastFixedPoints = null; return }

  if (state.phase === 'FIXED' || state.phase === 'EXPORTED') {
    if (state.fixedPoints !== _lastFixedPoints) {
      _lastFixedPoints = state.fixedPoints
      renderFixedTrack(map, state.fixedPoints, state.fitTrack, state.fixes)
    }
    return
  }

  if (state.fitTrack && state.fitTrack !== _lastFit) {
    _lastFit = state.fitTrack
    renderFitTrack(map, state.fitTrack)
  }
  if (state.gpxTrack && state.gpxTrack !== _lastGpx) {
    _lastGpx = state.gpxTrack
    renderGpxTrack(map, state.gpxTrack)
  }
})
