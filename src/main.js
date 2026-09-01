// src/main.js
import './style.css'
import { store } from './store.js'
import { initTopbar } from './ui/topbar.js'
import { initSidebar } from './ui/sidebar.js'
import { initPanel, showToast } from './ui/panel.js'
import { parseFit, detectGaps } from './io/fit-parser.js'
import { parseGpx } from './io/gpx-parser.js'
import { initMap } from './map/map.js'
import { renderFitTrack, renderGpxTrack, renderFixedTrack, clearAll, showScrubMarker, clearScrubMarker } from './map/track-layer.js'
import { buildFixedTrackFromGpx, writeFit, downloadFit } from './io/fit-writer.js'
import { initAnalysisPanel } from './ui/analysis-panel.js'
import { redirectToStravaLogin, handleAuthRedirect, refreshAuthIfNeeded, getStoredAuth } from './strava/auth.js'
import { fetchActivities, fetchRoutes, fetchActivityStreams, fetchRouteStreams } from './strava/api.js'
import { openStravaPicker, showStravaPickerLoading, closeStravaPicker } from './ui/strava-picker.js'

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

function handleStravaLogin() {
  redirectToStravaLogin()
}

async function pickStravaActivity() {
  const auth = await refreshAuthIfNeeded()
  if (!auth) { showToast('Strava session expired — please connect again'); return }

  showStravaPickerLoading('Choose the broken activity')
  try {
    const activities = await fetchActivities(auth.access_token)
    openStravaPicker({
      title: 'Choose the broken activity',
      items: activities,
      emptyMessage: 'No activities found on your Strava account.',
      formatItem: a => `
        <div class="strava-picker-item-title">${a.name}</div>
        <div class="strava-picker-item-meta">${a.type} · ${(a.distanceM / 1000).toFixed(1)} km · ${new Date(a.startDate).toLocaleDateString()}</div>
      `,
      onSelect: async activity => {
        showToast('Loading activity…', 'success')
        try {
          const points = await fetchActivityStreams(auth.access_token, activity.id)
          const gaps = detectGaps(points)
          const fitTrack = { activityType: activity.type.toLowerCase().includes('run') ? 'running' : 'cycling', points, gaps }
          store.setState({ phase: 'FIT_LOADED', fitTrack })
        } catch (e) {
          showToast(e.message || 'Could not load that activity')
        }
      },
    })
  } catch (e) {
    closeStravaPicker()
    showToast(e.message || 'Could not load your Strava activities')
  }
}

async function pickStravaRoute() {
  const auth = await refreshAuthIfNeeded()
  if (!auth) { showToast('Strava session expired — please connect again'); return }

  showStravaPickerLoading('Choose the reference route')
  try {
    const routes = await fetchRoutes(auth.access_token, auth.athlete?.id)
    openStravaPicker({
      title: 'Choose the reference route',
      items: routes,
      emptyMessage: 'No saved routes found on your Strava account.',
      formatItem: r => `
        <div class="strava-picker-item-title">${r.name}</div>
        <div class="strava-picker-item-meta">${r.type === 2 ? 'Run' : 'Ride'} · ${(r.distanceM / 1000).toFixed(1)} km</div>
      `,
      onSelect: async route => {
        showToast('Loading route…', 'success')
        try {
          const points = await fetchRouteStreams(auth.access_token, route.id)
          const gpxTrack = { activityType: route.type === 2 ? 'running' : 'cycling', points }
          store.setState({ phase: 'BOTH_LOADED', gpxTrack })
        } catch (e) {
          showToast(e.message || 'Could not load that route')
        }
      },
    })
  } catch (e) {
    closeStravaPicker()
    showToast(e.message || 'Could not load your Strava routes')
  }
}

const map = initMap()

initTopbar()
initSidebar({
  onFitFile: handleFitFile,
  onGpxFile: handleGpxFile,
  onAutoFix: doAutoFix,
  onStravaLogin: handleStravaLogin,
  onPickStravaActivity: pickStravaActivity,
  onPickStravaRoute: pickStravaRoute,
})

// Restore an existing session, or finish the OAuth redirect if we just came
// back from Strava with a ?code= in the URL.
;(async () => {
  const existing = getStoredAuth()
  if (existing) store.setState({ stravaAuth: existing })
  try {
    const fresh = await handleAuthRedirect()
    if (fresh) {
      store.setState({ stravaAuth: fresh })
      showToast('Connected to Strava', 'success')
    }
  } catch (e) {
    showToast(e.message)
  }
})()
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
