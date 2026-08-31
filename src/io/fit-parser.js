// src/io/fit-parser.js
import FitParser from 'fit-file-parser'

const SPORT_MAP = { cycling: 'cycling', running: 'running', 0: 'cycling', 1: 'running' }
const GAP_DISTANCE_THRESHOLD = 200  // metres
const GAP_TIME_THRESHOLD = 5 * 60 * 1000  // milliseconds

export function detectGaps(points) {
  const gaps = []
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const timeDiff = curr.timestamp - prev.timestamp
    const distJump = curr.distance - prev.distance
    if (distJump > GAP_DISTANCE_THRESHOLD && timeDiff < GAP_TIME_THRESHOLD) {
      gaps.push({ startIdx: i - 1, endIdx: i, distanceJump: distJump })
    }
  }
  return gaps
}

export function parseFit(arrayBuffer) {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({ force: true, speedUnit: 'km/h', lengthUnit: 'm', elapsedRecordField: true, mode: 'both' })
    parser.parse(arrayBuffer, (err, data) => {
      if (err) return reject(err)
      const session = data.activity?.sessions?.[0]
      const sport = session?.sport ?? 'cycling'
      const activityType = SPORT_MAP[sport] ?? 'cycling'
      const records = data.activity?.sessions?.flatMap(s => s.laps?.flatMap(l => l.records ?? []) ?? []) ?? []
      const points = records
        .filter(r => r.position_lat != null && r.position_long != null)
        .map(r => ({
          lat: r.position_lat,
          lng: r.position_long,
          ele: r.altitude ?? 0,
          timestamp: r.timestamp instanceof Date ? r.timestamp.getTime() : r.timestamp * 1000,
          hr: r.heart_rate ?? null,
          power: r.power ?? null,
          cadence: r.cadence ?? null,
          distance: r.distance ?? 0,
        }))
      if (points.length === 0) return reject(new Error('No GPS data found in this file'))
      const gaps = detectGaps(points)
      resolve({ activityType, points, gaps })
    })
  })
}
