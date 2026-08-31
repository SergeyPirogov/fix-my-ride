// src/io/gpx-parser.test.js
import { describe, it, expect } from 'vitest'
import { parseGpx } from './gpx-parser.js'

const MINIMAL_GPX = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <type>cycling</type>
    <trkseg>
      <trkpt lat="48.2000" lon="16.3000">
        <ele>180</ele>
        <time>2024-08-01T08:00:00Z</time>
        <extensions><hr>140</hr></extensions>
      </trkpt>
      <trkpt lat="48.2010" lon="16.3010">
        <ele>182</ele>
        <time>2024-08-01T08:00:10Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`

describe('parseGpx', () => {
  it('parses points from GPX string', () => {
    const track = parseGpx(MINIMAL_GPX)
    expect(track.points).toHaveLength(2)
    expect(track.points[0].lat).toBeCloseTo(48.2, 3)
    expect(track.points[0].lng).toBeCloseTo(16.3, 3)
    expect(track.points[0].ele).toBe(180)
  })

  it('detects activity type from trk type element', () => {
    const track = parseGpx(MINIMAL_GPX)
    expect(track.activityType).toBe('cycling')
  })

  it('defaults to cycling if type missing', () => {
    const gpx = MINIMAL_GPX.replace('<type>cycling</type>', '')
    const track = parseGpx(gpx)
    expect(track.activityType).toBe('cycling')
  })

  it('throws if no GPS points found', () => {
    const gpx = `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk></trk></gpx>`
    expect(() => parseGpx(gpx)).toThrow('No GPS data found in this file')
  })
})
