self.addEventListener('push', (event) => {
  const { title, note, url } = event.data.json()
  event.waitUntil(
    self.registration.showNotification(title ?? 'Reminder', {
      body: note,
      icon: '/favicon.svg',
      data: { url: url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/'))
})
