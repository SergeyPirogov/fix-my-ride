// src/store.js
const INITIAL_STATE = {
  phase: 'IDLE',        // IDLE | LOADED | SELECTING | FIXING | FIXED | EXPORTED
  track: null,
  segmentStart: null,   // point index (splice position — nearest point, not display coords)
  segmentEnd: null,     // point index (splice position)
  segmentStartPt: null, // { lat, lng } — exact coordinate the user set (click or typed)
  segmentEndPt: null,   // { lat, lng } — exact coordinate the user set
  suggestions: [],      // [{ route, distance, matchScore, label }]
  chosenRoute: null,
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
