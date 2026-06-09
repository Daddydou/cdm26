import { redirect } from 'next/navigation'

// Signout pour effacer la session stale avant de retourner sur /connexion.
// Sans ça : middleware → /inscription/completer → /connexion → / → boucle.
export default function CompleterPage() {
  redirect('/api/auth/signout')
}
