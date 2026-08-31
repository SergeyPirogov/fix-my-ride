// src/store.js
const INITIAL_STATE = {
  phase: 'IDLE',         // IDLE | LOADED | SEGMENT_SELECTED | FIXING | ROUTE_CHOSEN | EXPORTED
  track: null,           // internal track format (see spec)
  segmentStart: null,    // point index
  segmentEnd: null,      // point index
  suggestions: [],       // array of { route, distance, matchScore, label }
  chosenRoute: null,     // GeoJSON LineString coordinates array
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
