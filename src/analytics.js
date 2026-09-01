// src/analytics.js
// Thin wrapper around the Umami script tag in index.html. Umami injects
// window.umami itself once its script loads — this file just guards against
// calling it before that happens (ad blockers, slow network) or in local dev
// where the script may not load at all.

export function trackEvent(name, data) {
  window.umami?.track(name, data)
}
