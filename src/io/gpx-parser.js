// src/io/gpx-parser.js
import { detectGaps } from './fit-parser.js'

const SPORT_MAP = {
  cycling: 'cycling', biking: 'cycling', bike: 'cycling',
  running: 'running', run: 'running',
}

export function parseGpx(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml')
  const trkType = doc.querySelector('trk > type')?.textContent?.toLowerCase() ?? ''
  const activityType = SPORT_MAP[trkType] ?? 'cycling'

  let cumulativeDistance = 0
  const trkpts = Array.from(doc.querySelectorAll('trkpt'))
  if (trkpts.length === 0) throw new Error('No GPS data found in this file')

  const points = []
  for (let i = 0; i < trkpts.length; i++) {
    const pt = trkpts[i]
    const lat = parseFloat(pt.getAttribute('lat'))
    const lng = parseFloat(pt.getAttribute('lon'))
    const ele = parseFloat(pt.querySelector('ele')?.textContent ?? '0')
    const timeStr = pt.querySelector('time')?.textContent
    const timestamp = timeStr ? new Date(timeStr).getTime() : i * 1000
    const hr = pt.querySelector('hr') ? parseInt(pt.querySelector('hr').textContent) : null
    const power = pt.querySelector('power') ? parseInt(pt.querySelector('power').textContent) : null
    const cadence = pt.querySelector('cadence') ? parseInt(pt.querySelector('cadence').textContent) : null

    if (i > 0) {
      const prev = points[i - 1]
      const R = 6371000
      const lat1 = prev.lat * Math.PI / 180
      const lat2 = lat * Math.PI / 180
      const dLat = (lat - prev.lat) * Math.PI / 180
      const dLng = (lng - prev.lng) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
      cumulativeDistance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    points.push({ lat, lng, ele, timestamp, hr, power, cadence, distance: Math.round(cumulativeDistance) })
  }

  return { activityType, points, gaps: detectGaps(points) }
}
