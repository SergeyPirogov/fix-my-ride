// src/io/fit-writer.js

function haversineDistance(p1, p2) {
  const R = 6371000
  const lat1 = p1.lat * Math.PI / 180, lat2 = p2.lat * Math.PI / 180
  const dLat = (p2.lat - p1.lat) * Math.PI / 180
  const dLng = (p2.lng - p1.lng) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function sampleGpxAt10m(gpxPoints) {
  const TARGET = 10 // metres
  const result = []
  for (let i = 0; i < gpxPoints.length - 1; i++) {
    const p1 = gpxPoints[i]
    const p2 = gpxPoints[i + 1]
    const segDist = haversineDistance(p1, p2)
    const steps = Math.max(1, Math.round(segDist / TARGET))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      result.push({
        lat: p1.lat + (p2.lat - p1.lat) * t,
        lng: p1.lng + (p2.lng - p1.lng) * t,
        ele: p1.ele + (p2.ele - p1.ele) * t,
      })
    }
  }
  const last = gpxPoints[gpxPoints.length - 1]
  result.push({ lat: last.lat, lng: last.lng, ele: last.ele })
  return result
}

// Linearly interpolates a fit metric (hr/power/cadence/timestamp) at a given
// distance along the fit track's own (noisy but monotonic) distance field.
// Using the fit's real distance-vs-time/metric curve — instead of assuming
// constant pace — is what keeps HR/power varying naturally instead of
// flat-lining wherever the rider's real pace differed from the average.
function sampleFitAtDistance(fitPoints, targetDist, key) {
  const first = fitPoints[0]
  const last = fitPoints[fitPoints.length - 1]
  if (targetDist <= first.distance) return first[key]
  if (targetDist >= last.distance) return last[key]

  let lo = first, hi = last
  for (let i = 1; i < fitPoints.length; i++) {
    if (fitPoints[i].distance >= targetDist) { hi = fitPoints[i]; lo = fitPoints[i - 1]; break }
  }
  const span = hi.distance - lo.distance
  const frac = span > 0 ? (targetDist - lo.distance) / span : 0

  if (key === 'timestamp') return lo.timestamp + (hi.timestamp - lo.timestamp) * frac
  // hr/power/cadence: step to whichever endpoint is nearer in distance rather
  // than averaging two readings that may span a real physiological change
  const loVal = lo[key], hiVal = hi[key]
  if (loVal == null) return hiVal
  if (hiVal == null) return loVal
  return frac < 0.5 ? loVal : hiVal
}

// Replaces the entire route's geography with the gpx reference path, while
// keeping the fit track's recorded timing/HR/power/cadence: gpx points are
// remapped by distance-fraction onto the fit's own distance-vs-metric curve,
// so variable pace (stops, sprints, hills) still produces varying HR/power
// instead of the constant-pace assumption flat-lining long stretches.
export function buildFixedTrackFromGpx(fitTrack, gpxTrack) {
  const fitPoints = fitTrack.points
  const fitTotalDist = fitPoints[fitPoints.length - 1].distance || 1

  const sampled = sampleGpxAt10m(gpxTrack.points)
  let cumulDist = 0
  const sampledWithDist = sampled.map((pt, i) => {
    if (i > 0) cumulDist += haversineDistance(sampled[i - 1], pt)
    return { ...pt, localDist: cumulDist }
  })
  const totalDist = cumulDist || 1

  return sampledWithDist.map(pt => {
    const frac = pt.localDist / totalDist
    const fitTargetDist = frac * fitTotalDist
    return {
      lat: pt.lat,
      lng: pt.lng,
      ele: pt.ele,
      timestamp: sampleFitAtDistance(fitPoints, fitTargetDist, 'timestamp'),
      hr: sampleFitAtDistance(fitPoints, fitTargetDist, 'hr'),
      power: sampleFitAtDistance(fitPoints, fitTargetDist, 'power'),
      cadence: sampleFitAtDistance(fitPoints, fitTargetDist, 'cadence'),
      distance: Math.round(pt.localDist),
    }
  })
}

export function writeFit(points, activityType) {
  // Minimal FIT binary writer — records only the fields we need
  // FIT protocol: header (14 bytes) + file_id + session + lap + N record messages + CRC (2 bytes)
  // file_id/session/lap are required for consumers (Strava included) to trust
  // the record timestamps — without file_id in particular, Strava reports
  // "Time information is missing from file" even though every record has one.

  const buf = new ArrayBuffer(16 * 1024 * 1024) // 16MB max
  const view = new DataView(buf)
  let offset = 14 // skip header, fill after

  function writeU8(v) { view.setUint8(offset++, v) }
  function writeU16(v) { view.setUint16(offset, v, true); offset += 2 }
  function writeU32(v) { view.setUint32(offset, v, true); offset += 4 }
  function writeI32(v) { view.setInt32(offset, v, true); offset += 4 }

  const FIT_EPOCH = 631065600 // seconds between Unix epoch and FIT epoch (1989-12-31)
  // Strava dedupes uploads primarily by activity start_time, not file_id —
  // a fixed export that keeps the ride's exact original start time reads as
  // "this activity already exists" even with a fresh file_id. Shifting every
  // timestamp by a few seconds keeps duration/pacing intact while producing
  // a start_time Strava hasn't seen before.
  const TIME_SHIFT_SECONDS = 5
  const startTs = Math.round((points[0]?.timestamp ?? Date.now()) / 1000) - FIT_EPOCH + TIME_SHIFT_SECONDS
  const endTs = Math.round((points[points.length - 1]?.timestamp ?? Date.now()) / 1000) - FIT_EPOCH + TIME_SHIFT_SECONDS
  const totalElapsed = Math.max(0, endTs - startTs)
  const totalDistance = points[points.length - 1]?.distance ?? 0
  const SPORT = activityType === 'running' ? 1 : 2 // FIT sport enum: 1=running, 2=cycling

  // --- file_id (mesg_num=0), local msg 1 ---
  // Fields: type(1,enum), manufacturer(2,uint16), serial_number(3,uint32), time_created(4,uint32)
  // serial_number + a fresh time_created (file creation time, not ride start
  // time) keep this export from fingerprinting as a duplicate of the
  // original upload — Strava dedupes on file_id, and a fixed file re-using
  // the ride's own start timestamp as time_created collides with it.
  writeU8(0x41); writeU8(0x00); writeU8(0x00); writeU16(0); writeU8(4)
  writeU8(0); writeU8(1); writeU8(0)      // type: enum
  writeU8(1); writeU8(2); writeU8(132)    // manufacturer: uint16
  writeU8(3); writeU8(4); writeU8(134)    // serial_number: uint32
  writeU8(4); writeU8(4); writeU8(134)    // time_created: uint32
  writeU8(0x01) // data header local msg 1
  writeU8(4)                                            // type: activity
  writeU16(255)                                         // manufacturer: development
  writeU32((Date.now() % 0x100000000) >>> 0)             // serial_number: unique per export
  writeU32(Math.round(Date.now() / 1000) - FIT_EPOCH)    // time_created: now, not ride start

  // --- session (mesg_num=18), local msg 2 ---
  // Fields: timestamp(253,4), start_time(2,4), sport(5,1), total_elapsed_time(7,4), total_distance(9,4)
  writeU8(0x42); writeU8(0x00); writeU8(0x00); writeU16(18); writeU8(5)
  writeU8(253); writeU8(4); writeU8(134)
  writeU8(2); writeU8(4); writeU8(134)
  writeU8(5); writeU8(1); writeU8(0)
  writeU8(7); writeU8(4); writeU8(134)
  writeU8(9); writeU8(4); writeU8(134)
  writeU8(0x02) // data header local msg 2
  writeU32(endTs)
  writeU32(startTs)
  writeU8(SPORT)
  writeU32(Math.round(totalElapsed * 1000))
  writeU32(Math.round(totalDistance * 100))

  // --- lap (mesg_num=19), local msg 3 ---
  // Fields: timestamp(253,4), start_time(2,4), total_elapsed_time(7,4), total_distance(9,4)
  writeU8(0x43); writeU8(0x00); writeU8(0x00); writeU16(19); writeU8(4)
  writeU8(253); writeU8(4); writeU8(134)
  writeU8(2); writeU8(4); writeU8(134)
  writeU8(7); writeU8(4); writeU8(134)
  writeU8(9); writeU8(4); writeU8(134)
  writeU8(0x03) // data header local msg 3
  writeU32(endTs)
  writeU32(startTs)
  writeU32(Math.round(totalElapsed * 1000))
  writeU32(Math.round(totalDistance * 100))

  // --- record (mesg_num=20), local msg 0 ---
  // Fields: timestamp(4), position_lat(4), position_long(4), altitude(2), distance(4), heart_rate(1), power(2), cadence(1)
  writeU8(0x40)    // definition header (local msg 0)
  writeU8(0x00)    // reserved
  writeU8(0x00)    // little-endian arch
  writeU16(20)     // global msg num: record
  writeU8(8)       // field count

  // field defs: [field_def_num, size, base_type]
  const fieldDefs = [
    [253, 4, 134], // timestamp: uint32
    [0,   4, 133], // position_lat: sint32
    [1,   4, 133], // position_long: sint32
    [2,   2, 132], // altitude: uint16 (m * 5 + 500)
    [5,   4, 134], // distance: uint32 (cm)
    [3,   1, 2],   // heart_rate: uint8
    [7,   2, 132], // power: uint16
    [4,   1, 2],   // cadence: uint8
  ]
  fieldDefs.forEach(([num, size, type]) => { writeU8(num); writeU8(size); writeU8(type) })

  // Write record messages
  points.forEach(pt => {
    writeU8(0x00) // data header local msg 0
    writeU32(Math.round(pt.timestamp / 1000) - FIT_EPOCH + TIME_SHIFT_SECONDS)
    writeI32(Math.round(pt.lat * (2 ** 31 / 180)))
    writeI32(Math.round(pt.lng * (2 ** 31 / 180)))
    writeU16(Math.round(pt.ele * 5 + 500))
    writeU32(Math.round(pt.distance * 100))
    writeU8(pt.hr ?? 0xFF)
    writeU16(pt.power ?? 0xFFFF)
    writeU8(pt.cadence ?? 0xFF)
  })

  const dataSize = offset - 14
  const totalSize = offset + 2

  // Write FIT file header (14 bytes)
  const headerView = new DataView(buf, 0, 14)
  headerView.setUint8(0, 14)              // header size
  headerView.setUint8(1, 0x10)            // protocol version 1.0
  headerView.setUint16(2, 2132, true)     // profile version
  headerView.setUint32(4, dataSize, true) // data size
  headerView.setUint8(8, 0x2E)           // '.FIT'
  headerView.setUint8(9, 0x46)
  headerView.setUint8(10, 0x49)
  headerView.setUint8(11, 0x54)

  // CRC16 (FIT checksum)
  function crc16(data, len) {
    const CRC_TABLE = [0x0000,0xCC01,0xD801,0x1400,0xF001,0x3C00,0x2800,0xE401,0xA001,0x6C00,0x7800,0xB401,0x5000,0x9C01,0x8801,0x4400]
    let crc = 0
    for (let i = 0; i < len; i++) {
      let tmp = CRC_TABLE[crc & 0x0F]
      crc = (crc >> 4) & 0x0FFF
      crc ^= tmp ^ CRC_TABLE[(data[i]) & 0x0F]
      tmp = CRC_TABLE[crc & 0x0F]
      crc = (crc >> 4) & 0x0FFF
      crc ^= tmp ^ CRC_TABLE[(data[i] >> 4) & 0x0F]
    }
    return crc
  }

  const dataBytes = new Uint8Array(buf, 0, offset)
  const crc = crc16(dataBytes, offset)
  view.setUint16(offset, crc, true)

  return buf.slice(0, totalSize)
}

export function downloadFit(arrayBuffer, filename) {
  const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 100)
}
