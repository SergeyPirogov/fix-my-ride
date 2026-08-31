// src/main.js
import './style.css'
import { store } from './store.js'
import { initTopbar } from './ui/topbar.js'
import { initSidebar } from './ui/sidebar.js'
import { initPanel, showToast } from './ui/panel.js'
import { parseFit } from './io/fit-parser.js'
import { parseGpx } from './io/gpx-parser.js'
import { initMap } from './map/map.js'
import { renderFitTrack, renderGpxTrack, renderFixedTrack, clearAll, showScrubMarker, clearScrubMarker } from './map/track-layer.js'
import { buildFixedTrackFromGpx, writeFit, downloadFit } from './io/fit-writer.js'
import { initAnalysisPanel } from './ui/analysis-panel.js'

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

  const fixedPoints = buildFixedTrackFromGpx(fitTrack, gpxTrack)
  store.setState({ phase: 'FIXED', fixedPoints })
}

const map = initMap()

initTopbar()
initSidebar({ onFitFile: handleFitFile, onGpxFile: handleGpxFile, onAutoFix: doAutoFix })
initAnalysisPanel({
  onScrub: (latlng) => showScrubMarker(map, latlng),
  onScrubEnd: () => clearScrubMarker(map),
})
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
let _analysisPanelOpen = false
store.subscribe(state => {
  if (state.phase === 'IDLE') { clearAll(map); _lastFit = null; _lastGpx = null; _lastFixedPoints = null; return }

  const showsAnalysisPanel = state.phase === 'FIXED' || state.phase === 'EXPORTED'
  const panelJustToggled = showsAnalysisPanel !== _analysisPanelOpen
  if (panelJustToggled) _analysisPanelOpen = showsAnalysisPanel

  if (state.phase === 'FIXED' || state.phase === 'EXPORTED') {
    if (state.fixedPoints !== _lastFixedPoints) {
      _lastFixedPoints = state.fixedPoints
      // The analysis panel opening below the map changes its container
      // height via a CSS transition — invalidateSize() + refit once now
      // and once after the transition settles keeps the route centered
      // whether or not the panel was already open.
      const refit = () => {
        map.invalidateSize()
        renderFixedTrack(map, state.fixedPoints)
      }
      refit()
      setTimeout(refit, 350)
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
