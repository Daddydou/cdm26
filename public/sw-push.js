self.addEventListener('push', (event) => {
  const data = event.data?.json?.() ?? {}
  const title = data.title ?? 'CDM26 ⚽'
  const body = data.body ?? data.message ?? 'Rappel picks CDM26'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      data: { url: '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(clients.openWindow(url))
})
