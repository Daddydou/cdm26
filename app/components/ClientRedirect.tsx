'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ClientRedirect({ href }: { href: string }) {
  const router = useRouter()
  useEffect(() => { router.replace(href) }, [router, href])
  return null
}
