// src/main.js
import './style.css'
import { store } from './store.js'
import { initTopbar } from './ui/topbar.js'
import { initSidebar, recordRecentActivity } from './ui/sidebar.js'
import { initPanel, showToast } from './ui/panel.js'
import { parseFit } from './io/fit-parser.js'
import { parseGpx } from './io/gpx-parser.js'

async function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext !== 'fit' && ext !== 'gpx') {
    showToast('Only .fit and .gpx files are supported')
    return
  }
  try {
    let track
    if (ext === 'fit') {
      const buf = await file.arrayBuffer()
      track = await parseFit(buf)
    } else {
      const text = await file.text()
      track = parseGpx(text)
    }
    recordRecentActivity(track, file.name)
    store.setState({ phase: 'LOADED', track })
  } catch (e) {
    showToast(e.message || 'Failed to parse file')
  }
}

initTopbar()
initSidebar({ onFile: handleFile })
initPanel({ onChoose: () => {}, onDownload: () => {} })
