export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-white text-xl font-bold mb-4">Page introuvable</h2>
        <a href="/" className="text-green-400 hover:underline">Retour à l&apos;accueil</a>
      </div>
    </div>
  )
}
