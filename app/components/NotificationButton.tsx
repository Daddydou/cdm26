'use client'

import { usePushNotifications } from '@/hooks/usePushNotifications'

export default function NotificationButton() {
  const { isSupported, isSubscribed, subscribe, unsubscribe } = usePushNotifications()

  if (!isSupported) return null

  return (
    <button
      onClick={isSubscribed ? unsubscribe : subscribe}
      title={isSubscribed ? 'Désactiver les notifications' : 'Activer les notifications'}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
    >
      {isSubscribed ? '🔔' : '🔕'}
    </button>
  )
}
