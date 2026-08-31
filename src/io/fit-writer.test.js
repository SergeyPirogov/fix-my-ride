// src/io/fit-writer.test.js
import { describe, it, expect } from 'vitest'
import { buildFixedTrack } from './fit-writer.js'

const makePoint = (lat, lng, dist, ts, hr = 140) => ({
  lat, lng, ele: 100, timestamp: ts, hr, power: null, cadence: null, distance: dist
})

describe('buildFixedTrack', () => {
  it('preserves points before and after the segment', () => {
    const points = [
      makePoint(48.0, 16.0, 0, 1000),
      makePoint(48.1, 16.1, 1000, 2000),   // startIdx
      makePoint(48.3, 16.3, 3000, 3000),   // endIdx
      makePoint(48.4, 16.4, 4000, 4000),
    ]
    const track = { activityType: 'cycling', points, gaps: [] }
    // route: direct line from startPoint to endPoint with 2 intermediate coords
    const routeCoords = [[16.1, 48.1], [16.2, 48.2], [16.3, 48.3]]
    const result = buildFixedTrack(track, [{ startIdx: 1, endIdx: 2, route: routeCoords }])
    expect(result[0].lat).toBeCloseTo(48.0, 4)
    expect(result[result.length - 1].lat).toBeCloseTo(48.4, 4)
  })

  it('inserts interpolated points between start and end', () => {
    const points = [
      makePoint(48.0, 16.0, 0, 1000),
      makePoint(48.1, 16.1, 1000, 2000),
      makePoint(48.3, 16.3, 3000, 3000),
      makePoint(48.4, 16.4, 4000, 4000),
    ]
    const track = { activityType: 'cycling', points, gaps: [] }
    const routeCoords = [[16.1, 48.1], [16.15, 48.15], [16.2, 48.2], [16.25, 48.25], [16.3, 48.3]]
    const result = buildFixedTrack(track, [{ startIdx: 1, endIdx: 2, route: routeCoords }])
    expect(result.length).toBeGreaterThan(4)
  })

  it('flat-fills HR from average of last 5 points before gap', () => {
    const points = [
      makePoint(48.0, 16.0, 0, 1000, 130),
      makePoint(48.05, 16.05, 500, 1500, 135),
      makePoint(48.1, 16.1, 1000, 2000, 140),    // startIdx
      makePoint(48.3, 16.3, 3000, 3000, null),
      makePoint(48.4, 16.4, 4000, 4000, 150),
    ]
    const track = { activityType: 'cycling', points, gaps: [] }
    const routeCoords = [[16.1, 48.1], [16.2, 48.2], [16.3, 48.3]]
    const result = buildFixedTrack(track, [{ startIdx: 2, endIdx: 3, route: routeCoords }])
    const insertedPoints = result.slice(2, result.length - 1)
    const expectedHR = Math.round((130 + 135 + 140) / 3)
    insertedPoints.forEach(p => expect(p.hr).toBe(expectedHR))
  })

  it('returns points unchanged when no fixes have a route', () => {
    const points = [
      makePoint(48.0, 16.0, 0, 1000),
      makePoint(48.1, 16.1, 1000, 2000),
    ]
    const track = { activityType: 'cycling', points, gaps: [] }
    const result = buildFixedTrack(track, [{ startIdx: 0, endIdx: 1, route: null }])
    expect(result).toEqual(points)
  })

  it('applies multiple fixes in ascending order', () => {
    const points = [
      makePoint(48.0, 16.0, 0, 1000),
      makePoint(48.1, 16.1, 1000, 2000),   // gap 1 start
      makePoint(48.2, 16.2, 2000, 3000),   // gap 1 end
      makePoint(48.3, 16.3, 3000, 4000),
      makePoint(48.4, 16.4, 4000, 5000),   // gap 2 start
      makePoint(48.5, 16.5, 5000, 6000),   // gap 2 end
      makePoint(48.6, 16.6, 6000, 7000),
    ]
    const track = { activityType: 'cycling', points, gaps: [] }
    const fixes = [
      { startIdx: 4, endIdx: 5, route: [[16.4, 48.4], [16.5, 48.5]] },
      { startIdx: 1, endIdx: 2, route: [[16.1, 48.1], [16.2, 48.2]] },
    ]
    const result = buildFixedTrack(track, fixes)
    expect(result[0].lat).toBeCloseTo(48.0, 4)
    expect(result[result.length - 1].lat).toBeCloseTo(48.6, 4)
  })
})
