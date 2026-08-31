// src/io/fit-writer.js

function haversineDistance(p1, p2) {
  const R = 6371000
  const lat1 = p1.lat * Math.PI / 180, lat2 = p2.lat * Math.PI / 180
  const dLat = (p2.lat - p1.lat) * Math.PI / 180
  const dLng = (p2.lng - p1.lng) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function sampleRouteAt10m(routeCoords) {
  // routeCoords: [lng, lat][] from OSRM
  const TARGET = 10 // metres
  const result = []
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const [lng1, lat1] = routeCoords[i]
    const [lng2, lat2] = routeCoords[i + 1]
    const segDist = haversineDistance({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 })
    const steps = Math.max(1, Math.round(segDist / TARGET))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      result.push({ lat: lat1 + (lat2 - lat1) * t, lng: lng1 + (lng2 - lng1) * t })
    }
  }
  const last = routeCoords[routeCoords.length - 1]
  result.push({ lat: last[1], lng: last[0] })
  return result
}

export function buildFixedTrack(track, startIdx, endIdx, routeCoords) {
  const { points } = track
  const before = points.slice(0, startIdx)
  const after = points.slice(endIdx + 1)

  // Average HR/power/cadence from last 5 points before gap
  const preGap = points.slice(Math.max(0, startIdx - 4), startIdx + 1)
  const avgHr = preGap.some(p => p.hr != null)
    ? Math.round(preGap.filter(p => p.hr != null).reduce((s, p) => s + p.hr, 0) / preGap.filter(p => p.hr != null).length)
    : null
  const avgPower = preGap.some(p => p.power != null)
    ? Math.round(preGap.filter(p => p.power != null).reduce((s, p) => s + p.power, 0) / preGap.filter(p => p.power != null).length)
    : null
  const avgCadence = preGap.some(p => p.cadence != null)
    ? Math.round(preGap.filter(p => p.cadence != null).reduce((s, p) => s + p.cadence, 0) / preGap.filter(p => p.cadence != null).length)
    : null

  const startPt = points[startIdx]
  const endPt = points[endIdx]
  const gapDuration = endPt.timestamp - startPt.timestamp
  const gapStartDist = startPt.distance

  const sampled = sampleRouteAt10m(routeCoords)
  // Compute cumulative distance along sampled route
  let cumulDist = 0
  const sampledWithDist = sampled.map((pt, i) => {
    if (i > 0) cumulDist += haversineDistance(sampled[i - 1], pt)
    return { ...pt, localDist: cumulDist }
  })
  const totalRouteDist = cumulDist || 1

  const inserted = sampledWithDist.map((pt, i) => {
    const frac = pt.localDist / totalRouteDist
    const ele = startPt.ele + (endPt.ele - startPt.ele) * frac
    const timestamp = startPt.timestamp + gapDuration * frac
    const distance = gapStartDist + pt.localDist
    return { lat: pt.lat, lng: pt.lng, ele, timestamp, hr: avgHr, power: avgPower, cadence: avgCadence, distance }
  })

  // inserted covers startIdx..endIdx inclusive; before ends before startIdx, after starts after endIdx
  const middle = inserted

  // Rebuild result and recalculate cumulative distance
  const combined = [...before, ...middle, ...after]
  let runDist = 0
  return combined.map((pt, i) => {
    if (i > 0) runDist += haversineDistance(combined[i - 1], pt)
    return { ...pt, distance: Math.round(runDist) }
  })
}

export function writeFit(points, activityType) {
  // Minimal FIT binary writer — records only the fields we need
  // FIT protocol: header (14 bytes) + record messages + CRC (2 bytes)
  // We write: file_id message, session message, lap message, N record messages

  const buf = new ArrayBuffer(16 * 1024 * 1024) // 16MB max
  const view = new DataView(buf)
  let offset = 14 // skip header, fill after

  function writeU8(v) { view.setUint8(offset++, v) }
  function writeU16(v) { view.setUint16(offset, v, true); offset += 2 }
  function writeU32(v) { view.setUint32(offset, v, true); offset += 4 }
  function writeI32(v) { view.setInt32(offset, v, true); offset += 4 }

  // Definition message for record (mesg_num=20)
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

  const startTs = Math.round((points[0]?.timestamp ?? Date.now()) / 1000)
  const FIT_EPOCH = 631065600 // seconds between Unix epoch and FIT epoch (1989-12-31)

  // Write record messages
  points.forEach(pt => {
    writeU8(0x00) // data header local msg 0
    writeU32(Math.round(pt.timestamp / 1000) - FIT_EPOCH)
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
