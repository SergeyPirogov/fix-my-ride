// src/routing/gpx-match.test.js
import { describe, it, expect } from 'vitest'
import { matchGapToGpx, matchAllGaps } from './gpx-match.js'

const makePoint = (lat, lng) => ({ lat, lng, ele: 100, timestamp: 0, hr: null, power: null, cadence: null, distance: 0 })

describe('matchGapToGpx', () => {
  it('finds the gpx sub-path between the nearest points to the gap edges', () => {
    const fitTrack = {
      points: [
        makePoint(48.0, 16.0),
        makePoint(48.1, 16.1), // gap start
        makePoint(48.4, 16.4), // gap end
        makePoint(48.5, 16.5),
      ],
    }
    const gap = { startIdx: 1, endIdx: 2 }
    const gpxTrack = {
      points: [
        makePoint(48.0, 16.0),
        makePoint(48.1, 16.1),
        makePoint(48.2, 16.2),
        makePoint(48.3, 16.3),
        makePoint(48.4, 16.4),
        makePoint(48.5, 16.5),
      ],
    }
    const route = matchGapToGpx(fitTrack, gap, gpxTrack)
    expect(route).not.toBeNull()
    expect(route[0]).toEqual([16.1, 48.1])
    expect(route[route.length - 1]).toEqual([16.4, 48.4])
    expect(route.length).toBe(4)
  })

  it('returns null when the gap start and end match the same gpx point', () => {
    const fitTrack = { points: [makePoint(48.0, 16.0), makePoint(48.0, 16.0)] }
    const gap = { startIdx: 0, endIdx: 1 }
    const gpxTrack = { points: [makePoint(48.0, 16.0), makePoint(48.5, 16.5)] }
    const route = matchGapToGpx(fitTrack, gap, gpxTrack)
    expect(route).toBeNull()
  })

  it('reverses the gpx segment when it runs opposite to the fit gap direction', () => {
    const fitTrack = {
      points: [makePoint(48.4, 16.4), makePoint(48.0, 16.0)], // fit goes from high to low
    }
    const gap = { startIdx: 0, endIdx: 1 }
    const gpxTrack = {
      points: [
        makePoint(48.0, 16.0),
        makePoint(48.2, 16.2),
        makePoint(48.4, 16.4),
      ], // gpx recorded low to high
    }
    const route = matchGapToGpx(fitTrack, gap, gpxTrack)
    expect(route[0]).toEqual([16.4, 48.4])
    expect(route[route.length - 1]).toEqual([16.0, 48.0])
  })
})

describe('matchAllGaps', () => {
  it('marks gaps with no usable match as failed', () => {
    const fitTrack = {
      points: [makePoint(48.0, 16.0), makePoint(48.0, 16.0)],
      gaps: [{ startIdx: 0, endIdx: 1 }],
    }
    const gpxTrack = { points: [makePoint(48.0, 16.0), makePoint(48.5, 16.5)] }
    const fixes = matchAllGaps(fitTrack, gpxTrack)
    expect(fixes).toHaveLength(1)
    expect(fixes[0].status).toBe('failed')
    expect(fixes[0].route).toBeNull()
  })

  it('marks matched gaps as ok with a route', () => {
    const fitTrack = {
      points: [makePoint(48.0, 16.0), makePoint(48.1, 16.1), makePoint(48.4, 16.4), makePoint(48.5, 16.5)],
      gaps: [{ startIdx: 1, endIdx: 2 }],
    }
    const gpxTrack = {
      points: [makePoint(48.0, 16.0), makePoint(48.1, 16.1), makePoint(48.2, 16.2), makePoint(48.3, 16.3), makePoint(48.4, 16.4), makePoint(48.5, 16.5)],
    }
    const fixes = matchAllGaps(fitTrack, gpxTrack)
    expect(fixes[0].status).toBe('ok')
    expect(fixes[0].route).not.toBeNull()
  })
})
