// src/routing/gpx-match.js
// Matches broken .fit gaps to the corresponding sub-path in a reference .gpx track.

function nearestIdx(points, target) {
  let minDist = Infinity
  let minIdx = 0
  points.forEach((p, i) => {
    const d = Math.hypot(p.lat - target.lat, p.lng - target.lng)
    if (d < minDist) { minDist = d; minIdx = i }
  })
  return minIdx
}

// For one fit gap, find the matching gpx sub-path between the gpx points
// nearest to the fit's gap-start and gap-end. Returns [lng,lat][] (GeoJSON
// order, matching what buildSegmentInsert expects from OSRM routes) or null
// if no usable match exists (gpx points collapse to a single point).
export function matchGapToGpx(fitTrack, gap, gpxTrack) {
  const fitStart = fitTrack.points[gap.startIdx]
  const fitEnd = fitTrack.points[gap.endIdx]

  const gpxStartIdx = nearestIdx(gpxTrack.points, fitStart)
  const gpxEndIdx = nearestIdx(gpxTrack.points, fitEnd)

  const [lo, hi] = gpxStartIdx <= gpxEndIdx ? [gpxStartIdx, gpxEndIdx] : [gpxEndIdx, gpxStartIdx]
  if (hi - lo < 1) return null

  const slice = gpxTrack.points.slice(lo, hi + 1)
  const coords = slice.map(p => [p.lng, p.lat])
  // Reverse if the gpx segment runs the opposite direction from the fit gap
  return gpxStartIdx <= gpxEndIdx ? coords : coords.reverse()
}

// Runs matchGapToGpx for every detected gap in the fit track.
// Returns [{ gapIdx, startIdx, endIdx, route, status }] — status is
// 'ok' when a gpx match was found, 'failed' otherwise.
export function matchAllGaps(fitTrack, gpxTrack) {
  return fitTrack.gaps.map((gap, gapIdx) => {
    const route = matchGapToGpx(fitTrack, gap, gpxTrack)
    return {
      gapIdx,
      startIdx: gap.startIdx,
      endIdx: gap.endIdx,
      route,
      status: route ? 'ok' : 'failed',
    }
  })
}
