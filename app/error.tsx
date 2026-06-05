'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-white text-xl font-bold mb-4">Une erreur est survenue</h2>
        <button onClick={reset} className="bg-green-700 text-white px-4 py-2 rounded-lg">
          Réessayer
        </button>
      </div>
    </div>
  )
}
