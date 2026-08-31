import { describe, it, expect } from 'vitest'
import { scoreRoute } from './osrm.js'

describe('scoreRoute', () => {
  it('returns 1.0 when suggested distance matches gap exactly', () => {
    expect(scoreRoute(1000, 1000)).toBe(1)
  })

  it('returns 0.5 when suggested distance is 50% longer', () => {
    expect(scoreRoute(1500, 1000)).toBeCloseTo(0.5, 5)
  })

  it('clamps to 0 for very different distances', () => {
    expect(scoreRoute(5000, 500)).toBe(0)
  })

  it('handles gapDist = 0 without throwing', () => {
    expect(() => scoreRoute(100, 0)).not.toThrow()
  })
})
