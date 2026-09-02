// src/store.js
const INITIAL_STATE = {
  phase: 'IDLE',        // IDLE | FIT_LOADED | BOTH_LOADED | FIXING | FIXED | EXPORTED
  fitTrack: null,       // parsed broken .fit track
  gpxTrack: null,       // parsed reference .gpx track
  fixedPoints: null,    // the actual corrected point array — same data written to the exported .fit
  stravaAuth: null,     // { access_token, refresh_token, expires_at, athlete } | null
  visitorCity: null,    // detected visitor city (from geolocation), or null until resolved/denied
}

const _subscribers = new Set()
let _state = { ...INITIAL_STATE }

export const store = {
  get state() { return _state },
  setState(partial) {
    _state = { ..._state, ...partial }
    _subscribers.forEach(fn => fn(_state))
  },
  subscribe(fn) {
    _subscribers.add(fn)
    return () => _subscribers.delete(fn)
  },
  reset() {
    // Strava login survives "Start over"/"Discard" — it's a browser-session
    // credential, not part of the current fix workflow.
    _state = { ...INITIAL_STATE, stravaAuth: _state.stravaAuth, visitorCity: _state.visitorCity }
    _subscribers.forEach(fn => fn(_state))
  },
}
