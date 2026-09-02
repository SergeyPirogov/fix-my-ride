// src/analytics.js
// Thin wrapper around the Umami script tag in index.html. Umami injects
// window.umami itself once its script loads — this file just guards against
// calling it before that happens (ad blockers, slow network) or in local dev
// where the script may not load at all.

export function trackEvent(name, data) {
  window.umami?.track(name, data)
}

// Best-effort: ask the browser for the visitor's location once per page
// load, reverse-geocode it to a city via Nominatim (OpenStreetMap's free,
// keyless geocoder), and record it as a Umami event. Requires the user to
// grant the geolocation permission prompt — silently does nothing on
// denial, timeout, or any network failure, since this is purely a "where
// are our visitors coming from" signal and must never block the actual tool.
async function reverseGeocodeCity(coords, onCity) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    if (!res.ok) return
    const data = await res.json()
    const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county
    if (city) {
      trackEvent('visitor-city', { city, country: data.address?.country })
      onCity?.(city)
    }
  } catch {
    // Ignore — city tracking is not essential.
  }
}

// Falls back to IP-based geolocation (ipapi.co, free, keyless, city-level)
// when the browser's own geolocation is unavailable, denied, or fails —
// which happens often on desktop, where OS location backends (macOS
// CoreLocation in particular) frequently error out with no real fix on
// our end. Less precise than GPS, but doesn't need a permission prompt.
async function fallbackToIpLocation(onLocation, onCity) {
  try {
    const res = await fetch('https://ipapi.co/json/')
    if (!res.ok) return
    const data = await res.json()
    if (data.latitude != null && data.longitude != null) {
      onLocation?.({ latitude: data.latitude, longitude: data.longitude })
    }
    if (data.city) {
      trackEvent('visitor-city', { city: data.city, country: data.country_name, source: 'ip' })
      onCity?.(data.city)
    }
  } catch {
    // Ignore — city tracking is not essential.
  }
}

export function trackVisitorCity(onLocation, onCity) {
  if (!navigator.geolocation) {
    fallbackToIpLocation(onLocation, onCity)
    return
  }

  const onSuccess = ({ coords }) => {
    onLocation?.(coords)
    reverseGeocodeCity(coords, onCity)
  }
  const onFailure = () => fallbackToIpLocation(onLocation, onCity)

  // Desktop browsers resolve position via Wi-Fi/IP lookup rather than real
  // GPS, and that backend (macOS CoreLocation in particular) frequently
  // fails the first attempt with a transient "location unknown" error —
  // enableHighAccuracy:false favors that faster, more reliable network
  // lookup over GPS, and a single retry papers over the flakiness before
  // giving up and falling back to IP-based location entirely.
  navigator.geolocation.getCurrentPosition(
    onSuccess,
    () => {
      navigator.geolocation.getCurrentPosition(onSuccess, onFailure, { enableHighAccuracy: false, timeout: 3000 })
    },
    { enableHighAccuracy: false, timeout: 3000 }
  )
}
