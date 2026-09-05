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

// Some devices, after reacquiring signal from a real stop (frozen distance
// for a while), briefly backfill the missed distance in a burst — a
// catch-up or dead-reckoning-drift artifact, not real speed. It reads as an
// implausible speed spike (or, on a bad GPS-denied stretch, a sustained one
// lasting many seconds) right where the ride resumes. Rather than leave
// that burst's per-step speeds jagged, redistribute its own real
// timestamps evenly across its own real distance — same total distance,
// stretched to whatever duration keeps it at a plausible pace.
const STOP_MIN_DURATION_MS = 30 * 1000
const STOP_MAX_DISTANCE_M = 2
const BURST_SPEED_KMH = 90 // a step faster than this, right after a stop, is treated as a catch-up burst

// Average speed over every "normal" step in the ride — excludes stops
// (frozen distance) and GPS-gap-sized jumps, which aren't real pace. Used
// as the fallback target when a burst window's own average is itself still
// implausible (e.g. a GPS-denied stretch with bad distance data
// throughout, not just a brief catch-up blip) — this guarantees a sane
// result regardless of how bad the local window is.
function rideAverageSpeedMps(points) {
  let totalDist = 0, totalTime = 0
  for (let i = 1; i < points.length; i++) {
    const dDist = points[i].distance - points[i - 1].distance
    const dTime = points[i].timestamp - points[i - 1].timestamp
    if (dDist <= STOP_MAX_DISTANCE_M || dDist > GAP_DISTANCE_THRESHOLD || dTime <= 0) continue
    // Exclude burst-speed steps too — otherwise a bad stretch would
    // contaminate the very average being computed to fix it.
    if ((dDist / (dTime / 1000)) * 3.6 > BURST_SPEED_KMH) continue
    totalDist += dDist
    totalTime += dTime
  }
  return totalTime > 0 ? totalDist / (totalTime / 1000) : 0
}

export function smoothPostStopBursts(points) {
  if (points.length < 3) return points
  const out = points.slice()
  const rideAvgMps = rideAverageSpeedMps(points)

  for (let i = 1; i < out.length; i++) {
    const stopped = out[i].distance - out[i - 1].distance <= STOP_MAX_DISTANCE_M
    if (!stopped) continue
    // Walk to the end of this stop.
    let stopEnd = i
    while (stopEnd + 1 < out.length && out[stopEnd + 1].distance - out[stopEnd].distance <= STOP_MAX_DISTANCE_M) stopEnd++
    if (out[stopEnd].timestamp - out[i - 1].timestamp < STOP_MIN_DURATION_MS) { i = stopEnd; continue }

    // Walk forward from the stop's end through the catch-up burst — every
    // step whose implied speed is still above the threshold.
    let burstEnd = stopEnd
    while (burstEnd + 1 < out.length) {
      const dDist = out[burstEnd + 1].distance - out[burstEnd].distance
      const dTime = (out[burstEnd + 1].timestamp - out[burstEnd].timestamp) / 1000
      const kmh = dTime > 0 ? (dDist / dTime) * 3.6 : 0
      if (kmh <= BURST_SPEED_KMH) break
      burstEnd++
    }

    if (burstEnd > stopEnd) {
      const startDist = out[stopEnd].distance
      const totalDist = out[burstEnd].distance - startDist
      const recordedTime = out[burstEnd].timestamp - out[stopEnd].timestamp
      const recordedAvgKmh = recordedTime > 0 ? (totalDist / (recordedTime / 1000)) * 3.6 : Infinity
      // The window's own recorded time is only trustworthy as a target
      // once it itself implies a plausible pace — otherwise the whole
      // window has bad data (not just its first step), so stretch it to
      // the ride's real average pace instead of its own bogus duration.
      const totalTime = recordedAvgKmh <= BURST_SPEED_KMH && recordedTime > 0
        ? recordedTime
        : (rideAvgMps > 0 ? (totalDist / rideAvgMps) * 1000 : recordedTime)
      if (totalTime > 0 && totalDist > 0) {
        for (let j = stopEnd + 1; j <= burstEnd; j++) {
          const frac = (out[j].distance - startDist) / totalDist
          out[j] = { ...out[j], timestamp: out[stopEnd].timestamp + totalTime * frac }
        }
        // Stretching this window adds real time that wasn't in the
        // original recording — shift every later point forward by the same
        // amount so the rest of the ride stays chronologically consistent
        // (never overlapping the now-later end of this window).
        const addedTime = totalTime - recordedTime
        if (addedTime > 0) {
          for (let j = burstEnd + 1; j < out.length; j++) {
            out[j] = { ...out[j], timestamp: out[j].timestamp + addedTime }
          }
        }
      }
    }
    i = burstEnd
  }
  return out
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
      // Devices keep recording HR/power/cadence through a GPS dropout, so
      // dropping every record without a position (as this used to do) threw
      // away real sensor data for the exact stretch this app exists to fix —
      // lat/lng just come through as null and downstream consumers (map
      // rendering, the fix builder) already treat position as optional or
      // don't need it at all.
      const points = records
        .filter(r => r.distance != null)
        .map(r => ({
          lat: r.position_lat ?? null,
          lng: r.position_long ?? null,
          ele: r.altitude ?? 0,
          timestamp: r.timestamp instanceof Date ? r.timestamp.getTime() : r.timestamp * 1000,
          hr: r.heart_rate ?? null,
          power: r.power ?? null,
          cadence: r.cadence ?? null,
          distance: r.distance ?? 0,
        }))
      if (points.length === 0) return reject(new Error('No GPS data found in this file'))
      if (!points.some(p => p.lat != null)) return reject(new Error('No GPS data found in this file'))
      const smoothedPoints = smoothPostStopBursts(points)
      const gaps = detectGaps(smoothedPoints)
      resolve({ activityType, points: smoothedPoints, gaps })
    })
  })
}
