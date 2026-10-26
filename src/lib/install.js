// "Install the app": Android/Chrome hands us an install prompt (beforeinstallprompt) that we
// keep until the visitor asks for it; iPhone Safari has no prompt, so we show how instead
// (Share, then Add to Home Screen). Once the app runs from the home screen, none of this shows.
import { useSyncExternalStore } from 'react'

let deferred = null
const subs = new Set()
const emit = () => subs.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; emit() })
  window.addEventListener('appinstalled', () => { deferred = null; emit() })
}

export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

/** 'prompt' (Android/Chrome can install now), 'ios' (show the Share tip), or null. */
export function useInstall() {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f) },
    () => (isStandalone() ? null : deferred ? 'prompt' : isIos() ? 'ios' : null),
    () => null,
  )
}

export async function promptInstall() {
  if (!deferred) return false
  deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  emit()
  return outcome === 'accepted'
}
