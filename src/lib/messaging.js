import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

// register() can resolve before the worker has finished installing, and
// pushManager.subscribe() needs an *active* worker — without this wait it
// fails with "no active Service Worker".
async function waitForActiveServiceWorker(registration) {
  if (registration.active) return registration

  const worker = registration.installing ?? registration.waiting
  if (!worker) return registration

  await new Promise((resolve) => {
    worker.addEventListener('statechange', function onStateChange() {
      if (worker.state === 'activated') {
        worker.removeEventListener('statechange', onStateChange)
        resolve()
      }
    })
  })
  return registration
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0))
}

export async function enableReminderNotifications(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported on this device.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.')
  }

  const registration = await navigator.serviceWorker.register('/push-sw.js')
  await waitForActiveServiceWorker(registration)

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, subscription: subscription.toJSON() },
      { onConflict: 'user_id,endpoint' },
    )
  if (error) throw error

  return subscription
}

export function notificationPermissionState() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}
