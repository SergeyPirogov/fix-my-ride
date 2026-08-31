// src/io/fit-parser.test.js
import { describe, it, expect } from 'vitest'
import { detectGaps } from './fit-parser.js'

describe('detectGaps', () => {
  it('returns empty array when no gaps', () => {
    const points = [
      { lat: 48.0, lng: 16.0, distance: 0, timestamp: 1000000 },
      { lat: 48.001, lng: 16.0, distance: 100, timestamp: 1010000 },
      { lat: 48.002, lng: 16.0, distance: 200, timestamp: 1020000 },
    ]
    expect(detectGaps(points)).toEqual([])
  })

  it('detects gap when distance jump > 200m and time gap < 5min', () => {
    const points = [
      { lat: 48.0, lng: 16.0, distance: 0, timestamp: 1000000 },
      { lat: 48.0, lng: 16.0, distance: 0, timestamp: 1060000 },   // 60s later
      { lat: 48.003, lng: 16.003, distance: 450, timestamp: 1120000 }, // 450m jump in 60s
    ]
    const gaps = detectGaps(points)
    expect(gaps).toHaveLength(1)
    expect(gaps[0].startIdx).toBe(1)
    expect(gaps[0].endIdx).toBe(2)
    expect(gaps[0].distanceJump).toBeCloseTo(450, 0)
  })

  it('ignores gap if time elapsed > 5 minutes (intentional stop)', () => {
    const points = [
      { lat: 48.0, lng: 16.0, distance: 0, timestamp: 1000000 },
      { lat: 48.003, lng: 16.003, distance: 450, timestamp: 1000000 + 360000 }, // 6 min gap
    ]
    expect(detectGaps(points)).toEqual([])
  })
})
