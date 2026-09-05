// src/io/fit-parser.test.js
import { describe, it, expect } from 'vitest'
import { detectGaps, smoothPostStopBursts } from './fit-parser.js'

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

describe('smoothPostStopBursts', () => {
  const p = (dist, ts) => ({ lat: 48.0, lng: 16.0, ele: 0, hr: null, power: null, cadence: null, distance: dist, timestamp: ts })

  it('spreads a brief post-stop catch-up burst to a plausible pace', () => {
    // Steady ~36 km/h, then frozen for 60s (a real stop), then the device
    // backfills 500m in a single 2s step (~900 km/h) before settling back
    // to the same steady pace.
    const points = [
      p(0, 0), p(100, 10000), p(200, 20000),      // 36 km/h
      p(200, 80000),                               // stopped 60s
      p(700, 82000),                                // catch-up burst: 500m in 2s
      p(800, 92000), p(900, 102000),                // resumes at 36 km/h
    ]
    const result = smoothPostStopBursts(points)

    for (let i = 1; i < result.length; i++) {
      const dDist = result[i].distance - result[i - 1].distance
      const dTime = (result[i].timestamp - result[i - 1].timestamp) / 1000
      expect(dTime).toBeGreaterThanOrEqual(0) // timestamps never go backward
      if (dTime > 0) expect((dDist / dTime) * 3.6).toBeLessThanOrEqual(90.01)
    }
    // total distance is never altered by smoothing, only timestamps
    expect(result[result.length - 1].distance).toBe(points[points.length - 1].distance)
  })

  it('falls back to the ride average when the whole burst window is bad, not just its first step', () => {
    // A real-world case: after a stop, several minutes of GPS-denied,
    // dead-reckoning-drift data implies a sustained ~200 km/h — the
    // window's OWN average is still implausible, so smoothing must fall
    // back to the ride's real average pace instead of that window's bogus
    // duration (see commit history for the real-file repro).
    const points = [
      p(0, 0), p(100, 10000), p(200, 20000), p(300, 30000), p(400, 40000), // steady 36 km/h
      p(400, 100000),                                                       // stopped 60s
      // "recovers" into a sustained bad stretch: ~56 m/s (~200 km/h) for 10 steps
      ...Array.from({ length: 10 }, (_, i) => p(400 + (i + 1) * 56, 100000 + (i + 1) * 1000)),
      p(1060, 120000), p(1160, 130000),                                     // back to steady 36 km/h
    ]
    const result = smoothPostStopBursts(points)

    let maxKmh = 0
    for (let i = 1; i < result.length; i++) {
      const dDist = result[i].distance - result[i - 1].distance
      const dTime = (result[i].timestamp - result[i - 1].timestamp) / 1000
      expect(dTime).toBeGreaterThanOrEqual(0)
      if (dTime > 0) maxKmh = Math.max(maxKmh, (dDist / dTime) * 3.6)
    }
    expect(maxKmh).toBeLessThanOrEqual(36.01) // capped to this ride's own steady pace, not left at ~200
    expect(result[result.length - 1].distance).toBe(points[points.length - 1].distance)
  })
})
