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
import { fetchSuggestions } from './routing/suggestions.js'

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
let suggestionLayer = null

initPanel({
  onChoose: (suggestion) => {
    if (suggestionLayer) removeSuggestionLayer(map, suggestionLayer)
    suggestionLayer = addSuggestionLayer(map, suggestion.route)
    store.setState({ chosenRoute: suggestion.route })
  },
  onDownload: () => {} // Task 8
})

initSelection(map, {
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
})

store.subscribe(state => {
  if (state.phase === 'IDLE') { clearTrack(map); return }
  if (state.track) renderTrack(map, state.track)
})
