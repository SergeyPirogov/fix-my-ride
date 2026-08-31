// src/routing/suggestions.js
import { fetchOsrmRoutes, scoreRoute } from './osrm.js'

export async function fetchSuggestions(track, startIdx, endIdx) {
  const startPoint = track.points[startIdx]
  const endPoint = track.points[endIdx]
  const gapDist = endPoint.distance - startPoint.distance

  let routes
  try {
    routes = await fetchOsrmRoutes(startPoint, endPoint, track.activityType)
  } catch (e) {
    if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
      throw new Error('OSRM routing unavailable — check your connection or draw the route manually')
    }
    throw e
  }

  return routes.map((r, i) => ({
    route: r.geometry.coordinates,
    distance: r.distance,
    matchScore: scoreRoute(r.distance, gapDist),
    label: i === 0 ? 'Shortest Route' : i === 1 ? 'Alternative Route' : `Option ${i + 1}`,
  })).sort((a, b) => b.matchScore - a.matchScore)
}
