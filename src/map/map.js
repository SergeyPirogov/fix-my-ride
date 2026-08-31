// src/map/map.js
import L from 'leaflet'

export function initMap() {
  const map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    center: [48.2, 16.37],
    zoom: 13,
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map)

  // Custom zoom controls (sidebar has its own chrome)
  const zoomDiv = document.createElement('div')
  zoomDiv.className = 'map-zoom-controls'
  zoomDiv.innerHTML = `
    <button class="map-zoom-btn" id="zoom-in">+</button>
    <button class="map-zoom-btn" id="zoom-out">−</button>
  `
  document.getElementById('map').appendChild(zoomDiv)
  document.getElementById('zoom-in').addEventListener('click', () => map.zoomIn())
  document.getElementById('zoom-out').addEventListener('click', () => map.zoomOut())

  return map
}
