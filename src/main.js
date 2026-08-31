// src/main.js
import './style.css'
import { store } from './store.js'
import { initTopbar } from './ui/topbar.js'
import { initSidebar, recordRecentActivity } from './ui/sidebar.js'
import { initPanel, showToast } from './ui/panel.js'
import { parseFit } from './io/fit-parser.js'
import { parseGpx } from './io/gpx-parser.js'
import { initMap } from './map/map.js'
import { renderTrack, clearTrack, addSuggestionLayer, removeSuggestionLayer } from './map/track-layer.js'
import { initSelection } from './map/selection.js'
import { initDrawMode } from './map/draw-mode.js'
import { fetchSuggestions } from './routing/suggestions.js'
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
    // Pre-select first detected gap if any
    const firstGap = track.gaps[0]
    const startPt = firstGap ? { lat: track.points[firstGap.startIdx].lat, lng: track.points[firstGap.startIdx].lng } : null
    const endPt = firstGap ? { lat: track.points[firstGap.endIdx].lat, lng: track.points[firstGap.endIdx].lng } : null
    store.setState({
      phase: 'LOADED',
      track,
      suggestions: [],
      chosenRoute: null,
      segmentStart: firstGap?.startIdx ?? null,
      segmentEnd: firstGap?.endIdx ?? null,
      segmentStartPt: startPt,
      segmentEndPt: endPt,
    })
  } catch (e) {
    showToast(e.message || 'Failed to parse file')
  }
}

const map = initMap()

initTopbar()

let suggestionLayer = null

async function doFindRoute(startIdx, endIdx, startPt, endPt) {
  store.setState({ phase: 'FIXING', segmentStart: startIdx, segmentEnd: endIdx, segmentStartPt: startPt, segmentEndPt: endPt })
  if (suggestionLayer) { removeSuggestionLayer(map, suggestionLayer); suggestionLayer = null }
  try {
    const suggestions = await fetchSuggestions(store.state.track, startIdx, endIdx, startPt, endPt)
    const chosenRoute = suggestions[0]?.route ?? null
    if (chosenRoute) suggestionLayer = addSuggestionLayer(map, chosenRoute)
    store.setState({ phase: 'FIXED', suggestions, chosenRoute })
  } catch (e) {
    showToast(e.message, 'warning')
    store.setState({ phase: 'FIXED', suggestions: [], chosenRoute: null })
  }
}

const selection = initSelection(map, {
  onSegmentChange: (startIdx, endIdx, startPt, endPt) => doFindRoute(startIdx, endIdx, startPt, endPt),
  onDrawModeToggle: () => {}
})

initSidebar({ onFile: handleFile, onFindRoute: doFindRoute, onUndo: selection.undo })

const drawMode = initDrawMode(map, {
  onRouteComplete: (coords) => {
    if (suggestionLayer) { removeSuggestionLayer(map, suggestionLayer); suggestionLayer = null }
    suggestionLayer = addSuggestionLayer(map, coords)
    const manualSuggestion = { route: coords, distance: 0, matchScore: 1, label: 'Manual Route' }
    const existing = store.state.suggestions
    store.setState({
      phase: 'FIXED',
      suggestions: [manualSuggestion, ...existing.filter(s => s.label !== 'Manual Route')],
      chosenRoute: coords,
    })
  }
})

initPanel({
  onChoose: (suggestion) => {
    if (suggestionLayer) { removeSuggestionLayer(map, suggestionLayer); suggestionLayer = null }
    suggestionLayer = addSuggestionLayer(map, suggestion.route)
    store.setState({ chosenRoute: suggestion.route })
  },
  onDrawMode: () => drawMode.activate(),
  onDownload: () => {
    const { track, segmentStart, segmentEnd, chosenRoute } = store.state
    if (!track || !chosenRoute) {
      showToast('Choose a route first')
      return
    }
    try {
      const fixedPoints = buildFixedTrack(track, [{ startIdx: segmentStart, endIdx: segmentEnd, route: chosenRoute }])
      const fitBuffer = writeFit(fixedPoints, track.activityType)
      downloadFit(fitBuffer, `fixed-ride-${Date.now()}.fit`)
      store.setState({ phase: 'EXPORTED' })
    } catch (e) {
      showToast('Export failed — check browser console')
      console.error(e)
    }
  }
})

let _lastTrack = null
store.subscribe(state => {
  if (state.phase === 'IDLE') { clearTrack(map); _lastTrack = null; return }
  if (state.track && state.track !== _lastTrack) {
    _lastTrack = state.track
    renderTrack(map, state.track)
  }
})
