// src/main.js
import './style.css'
import { store } from './store.js'
import { initTopbar } from './ui/topbar.js'
import { initSidebar, recordRecentActivity } from './ui/sidebar.js'
import { initPanel, showToast } from './ui/panel.js'
import { parseFit } from './io/fit-parser.js'
import { parseGpx } from './io/gpx-parser.js'
import { initMap } from './map/map.js'
import { renderTrack, clearTrack, renderFixes, clearFixes, addSuggestionLayer, removeSuggestionLayer } from './map/track-layer.js'
import { initDrawMode } from './map/draw-mode.js'
import { autoFixAllGaps } from './routing/suggestions.js'
import { buildFixedTrack, writeFit, downloadFit } from './io/fit-writer.js'

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
    store.setState({ phase: 'LOADED', track, fixes: [], activeGapIdx: null })

    if (track.gaps.length === 0) {
      store.setState({ phase: 'FIXED', fixes: [] })
      return
    }

    store.setState({ phase: 'AUTO_FIXING' })
    const fixes = await autoFixAllGaps(track)
    store.setState({ phase: 'FIXED', fixes })

    const failCount = fixes.filter(f => f.status === 'failed').length
    if (failCount > 0) {
      showToast(`${failCount} gap${failCount > 1 ? 's' : ''} could not be auto-routed. Draw them manually.`, 'warning')
    }
  } catch (e) {
    showToast(e.message || 'Failed to parse file')
    store.reset()
  }
}

const map = initMap()

initTopbar()
initSidebar({ onFile: handleFile })

let suggestionLayer = null
const drawMode = initDrawMode(map, {
  onRouteComplete: (coords, gapIdx) => {
    if (suggestionLayer) { removeSuggestionLayer(map, suggestionLayer); suggestionLayer = null }
    const fixes = store.state.fixes.map(f =>
      f.gapIdx === gapIdx
        ? { ...f, route: coords, status: 'manual', suggestions: f.suggestions }
        : f
    )
    store.setState({ fixes, phase: 'FIXED', activeGapIdx: null })
  }
})

initPanel({
  onChooseRoute: (gapIdx, suggestion) => {
    if (suggestionLayer) { removeSuggestionLayer(map, suggestionLayer); suggestionLayer = null }
    suggestionLayer = addSuggestionLayer(map, suggestion.route)
    const fixes = store.state.fixes.map(f =>
      f.gapIdx === gapIdx
        ? { ...f, route: suggestion.route, distance: suggestion.distance, status: f.status === 'failed' ? 'ok' : f.status }
        : f
    )
    store.setState({ fixes })
  },
  onDrawGap: (gapIdx) => {
    const fix = store.state.fixes.find(f => f.gapIdx === gapIdx)
    if (!fix) return
    const startPt = store.state.track.points[fix.startIdx]
    const endPt = store.state.track.points[fix.endIdx]
    store.setState({ activeGapIdx: null })
    drawMode.activate(startPt, endPt, gapIdx)
  },
  onDownload: () => {
    const { track, fixes } = store.state
    if (!track) { showToast('No track loaded'); return }
    const fixable = fixes.filter(f => f.route)
    if (fixable.length === 0 && track.gaps.length > 0) {
      showToast('No routes to apply yet')
      return
    }
    try {
      const fixedPoints = buildFixedTrack(track, fixable)
      const fitBuffer = writeFit(fixedPoints, track.activityType)
      downloadFit(fitBuffer, `fixed-ride-${Date.now()}.fit`)
      store.setState({ phase: 'EXPORTED' })
    } catch (e) {
      showToast('Export failed — check browser console for details')
      console.error(e)
    }
  }
})

// Track rendering
let _lastTrack = null
store.subscribe(state => {
  if (state.phase === 'IDLE') { clearTrack(map); clearFixes(map); _lastTrack = null; return }
  if (state.track && state.track !== _lastTrack) {
    _lastTrack = state.track
    renderTrack(map, state.track)
  }
  if (state.phase === 'FIXED' || state.phase === 'EXPORTED') {
    renderFixes(map, state.track, state.fixes)
  }
})
