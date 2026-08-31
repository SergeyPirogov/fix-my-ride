// src/store.js
const INITIAL_STATE = {
  phase: 'IDLE',        // IDLE | FIT_LOADED | BOTH_LOADED | FIXING | FIXED | EXPORTED
  fitTrack: null,       // parsed broken .fit track
  gpxTrack: null,       // parsed reference .gpx track
  fixes: [],            // [{ gapIdx, startIdx, endIdx, route, status:'ok'|'failed' }]
  fixedPoints: null,    // the actual corrected point array — same data written to the exported .fit
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
    _state = { ...INITIAL_STATE }
    _subscribers.forEach(fn => fn(_state))
  },
}
