// src/io/fit-writer.test.js
import { describe, it, expect } from 'vitest'
import { buildFixedTrackFromGpx } from './fit-writer.js'

const makePoint = (lat, lng, dist, ts, hr = 140) => ({
  lat, lng, ele: 100, timestamp: ts, hr, power: null, cadence: null, distance: dist
})
const makeGpxPoint = (lat, lng, ele = 100) => ({ lat, lng, ele })

describe('buildFixedTrackFromGpx', () => {
  it('follows the gpx path from start to end', () => {
    const fitTrack = {
      points: [
        makePoint(48.0, 16.0, 0, 1000, 130),
        makePoint(10.0, 10.0, 500, 2000, 140), // wildly broken point — must not affect output geography
        makePoint(48.2, 16.2, 1000, 3000, 150),
      ],
    }
    const gpxTrack = {
      points: [
        makeGpxPoint(48.0, 16.0),
        makeGpxPoint(48.1, 16.1),
        makeGpxPoint(48.2, 16.2),
      ],
    }
    const result = buildFixedTrackFromGpx(fitTrack, gpxTrack)
    expect(result[0].lat).toBeCloseTo(48.0, 3)
    expect(result[0].lng).toBeCloseTo(16.0, 3)
    expect(result[result.length - 1].lat).toBeCloseTo(48.2, 3)
    expect(result[result.length - 1].lng).toBeCloseTo(16.2, 3)
    // no point should ever be the broken outlier's coordinates
    result.forEach(p => expect(p.lat).toBeGreaterThan(40))
  })

  it('preserves the fit track total duration', () => {
    const fitTrack = {
      points: [
        makePoint(48.0, 16.0, 0, 1000, 130),
        makePoint(48.2, 16.2, 1000, 61000, 150), // 60s ride
      ],
    }
    const gpxTrack = { points: [makeGpxPoint(48.0, 16.0), makeGpxPoint(48.2, 16.2)] }
    const result = buildFixedTrackFromGpx(fitTrack, gpxTrack)
    expect(result[0].timestamp).toBe(1000)
    expect(result[result.length - 1].timestamp).toBeCloseTo(61000, -1)
  })

  it('carries hr/power/cadence from the fit track proportionally by time', () => {
    const fitTrack = {
      points: [
        makePoint(48.0, 16.0, 0, 1000, 100),
        makePoint(48.1, 16.1, 500, 2000, 200),
        makePoint(48.2, 16.2, 1000, 3000, 300),
      ],
    }
    const gpxTrack = { points: [makeGpxPoint(48.0, 16.0), makeGpxPoint(48.2, 16.2)] }
    const result = buildFixedTrackFromGpx(fitTrack, gpxTrack)
    expect(result[0].hr).toBe(100)
    expect(result[result.length - 1].hr).toBe(300)
  })
})
