import { describe, it, expect, vi } from 'vitest'
import { store } from './store.js'

describe('store', () => {
  it('starts in IDLE phase', () => {
    store.reset()
    expect(store.state.phase).toBe('IDLE')
  })

  it('setState merges partial state', () => {
    store.reset()
    store.setState({ phase: 'LOADED' })
    expect(store.state.phase).toBe('LOADED')
    expect(store.state.track).toBeNull()
  })

  it('notifies subscribers on setState', () => {
    store.reset()
    const fn = vi.fn()
    const unsub = store.subscribe(fn)
    store.setState({ phase: 'LOADED' })
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ phase: 'LOADED' }))
    unsub()
  })

  it('unsubscribe stops notifications', () => {
    store.reset()
    const fn = vi.fn()
    const unsub = store.subscribe(fn)
    unsub()
    store.setState({ phase: 'LOADED' })
    expect(fn).not.toHaveBeenCalled()
  })

  it('reset returns to IDLE', () => {
    store.setState({ phase: 'ROUTE_CHOSEN', segmentStart: 5 })
    store.reset()
    expect(store.state.phase).toBe('IDLE')
    expect(store.state.segmentStart).toBeNull()
  })
})
