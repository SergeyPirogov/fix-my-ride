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
export function trackVisitorCity() {
  if (!navigator.geolocation) return

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
        if (!res.ok) return
        const data = await res.json()
        const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county
        if (city) trackEvent('visitor-city', { city, country: data.address?.country })
      } catch {
        // Ignore — city tracking is not essential.
      }
    },
    () => {}, // permission denied or unavailable — no-op
    { timeout: 5000 }
  )
}
