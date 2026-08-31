/**
 * Haptic feedback utilities using the Web Vibration API.
 * Works on most Android browsers and some iOS Safari versions.
 * Falls back gracefully on devices that don't support vibration.
 */

const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator

/** Light tap — button presses, toggles, tab switches */
export function hapticTap() {
  if (isSupported) navigator.vibrate(10)
}

/** Medium impact — completing a sale, adding to cart */
export function hapticImpact() {
  if (isSupported) navigator.vibrate(20)
}

/** Heavy impact — delete, error, confirmation */
export function hapticHeavy() {
  if (isSupported) navigator.vibrate([30, 10, 30])
}

/** Success pattern — sale completed, save succeeded */
export function hapticSuccess() {
  if (isSupported) navigator.vibrate([10, 30, 10])
}

/** Error pattern — validation error, failed action */
export function hapticError() {
  if (isSupported) navigator.vibrate([50, 50, 50])
}
