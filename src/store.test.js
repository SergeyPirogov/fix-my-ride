import { describe, it, expect, vi } from 'vitest'
import { store } from './store.js'

describe('store', () => {
  it('starts in IDLE phase', () => {
    store.reset()
    expect(store.state.phase).toBe('IDLE')
  })

  it('setState merges partial state', () => {
    store.reset()
    store.setState({ phase: 'FIT_LOADED' })
    expect(store.state.phase).toBe('FIT_LOADED')
    expect(store.state.gpxTrack).toBeNull()
  })

  it('notifies subscribers on setState', () => {
    store.reset()
    const fn = vi.fn()
    const unsub = store.subscribe(fn)
    store.setState({ phase: 'FIT_LOADED' })
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ phase: 'FIT_LOADED' }))
    unsub()
  })

  it('unsubscribe stops notifications', () => {
    store.reset()
    const fn = vi.fn()
    const unsub = store.subscribe(fn)
    unsub()
    store.setState({ phase: 'FIT_LOADED' })
    expect(fn).not.toHaveBeenCalled()
  })

  it('reset returns to IDLE', () => {
    store.setState({ phase: 'FIXED', fixedPoints: [{ lat: 1, lng: 1 }] })
    store.reset()
    expect(store.state.phase).toBe('IDLE')
    expect(store.state.fixedPoints).toBeNull()
  })
})
