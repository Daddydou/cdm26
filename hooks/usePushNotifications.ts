'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const view = new DataView(buffer)
  for (let i = 0; i < rawData.length; ++i) {
    view.setUint8(i, rawData.charCodeAt(i))
  }
  return buffer
}

async function getPushRegistration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw-push.js')
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    setIsSupported(supported)

    if (!supported) return

    getPushRegistration()
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setIsSubscribed(!!sub))
      .catch(console.error)
  }, [])

  async function subscribe() {
    if (!isSupported) return

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const reg = await getPushRegistration()
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: cdmUser } = await supabase
      .from('cdm_users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!cdmUser) return

    await supabase.from('cdm_push_subscriptions').upsert(
      { user_id: cdmUser.id, subscription: subscription.toJSON() },
      { onConflict: 'user_id' },
    )

    setIsSubscribed(true)
  }

  async function unsubscribe() {
    if (!isSupported) return

    const reg = await getPushRegistration()
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return

    await sub.unsubscribe()

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: cdmUser } = await supabase
      .from('cdm_users')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!cdmUser) return

    await supabase.from('cdm_push_subscriptions').delete().eq('user_id', cdmUser.id)
    setIsSubscribed(false)
  }

  return { isSupported, isSubscribed, subscribe, unsubscribe }
}
