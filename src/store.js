// src/store.js
const INITIAL_STATE = {
  phase: 'IDLE',         // IDLE | LOADED | AUTO_FIXING | FIXED | EXPORTED
  track: null,           // internal track format
  fixes: [],             // [{ gapIdx, startIdx, endIdx, route, status:'ok'|'failed'|'manual', suggestions, distance }]
  activeGapIdx: null,    // which gap the redraw panel is open for
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
