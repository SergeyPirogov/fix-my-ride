// src/ui/strava-picker.js
// A simple modal overlay listing Strava activities or routes, used for both
// "pick the broken activity" and "pick the reference route" flows.

export function openStravaPicker({ title, items, emptyMessage, formatItem, onSelect, onClose }) {
  const existing = document.getElementById('strava-picker-overlay')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.id = 'strava-picker-overlay'
  overlay.className = 'strava-picker-overlay'
  overlay.innerHTML = `
    <div class="strava-picker-modal">
      <div class="strava-picker-header">
        <span>${title}</span>
        <button class="strava-picker-close" id="strava-picker-close">✕</button>
      </div>
      <div class="strava-picker-list">
        ${items.length === 0
          ? `<div class="strava-picker-empty">${emptyMessage}</div>`
          : items.map((item, i) => `
            <button class="strava-picker-item" data-idx="${i}">
              ${formatItem(item)}
            </button>
          `).join('')
        }
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  function close() {
    overlay.remove()
    onClose?.()
  }

  overlay.addEventListener('click', e => { if (e.target === overlay) close() })
  document.getElementById('strava-picker-close').addEventListener('click', close)
  overlay.querySelectorAll('.strava-picker-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = items[parseInt(btn.dataset.idx)]
      overlay.remove()
      onSelect(item)
    })
  })
}

export function showStravaPickerLoading(title) {
  openStravaPicker({ title, items: [], emptyMessage: '', formatItem: () => '', onSelect: () => {} })
  const list = document.querySelector('.strava-picker-list')
  if (list) list.innerHTML = `<div class="strava-picker-loading"><div class="spinner"></div></div>`
}

export function closeStravaPicker() {
  document.getElementById('strava-picker-overlay')?.remove()
}
