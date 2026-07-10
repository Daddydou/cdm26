// ─── Bonus — libellés & mention réutilisable ───────────────────────────────────
//
// Affiche de façon cohérente, partout où on présente un pick :
//   • le joueur ciblé par le bonus « Joueur ×2 » (⭐)
//   • le nom lisible (FR) du bonus de match utilisé
//
// N.B. : purement de l'affichage — aucune logique de calcul de points ici.

/** Mapping des types techniques (cdm_picks.bonus_type) → libellés FR lisibles. */
export const BONUS_TYPE_LABELS: Record<string, string> = {
  sniper:          'Sniper',
  passeur_genie:   'Passeur de génie',
  mur:             'Le Mur',
  bouclier:        'Bouclier',
  espion:          'Espion',
  double_mise:     'Double mise',
  all_in:          'All-in',
  troisieme_homme: 'Troisième homme',
}

/**
 * Le bonus « Joueur ×2 » correspond au cas où bonus_player_id est rempli,
 * indépendamment de bonus_type — à l'exception du « Troisième homme », seul
 * autre bonus qui référence un joueur (le 3e joueur ajouté, pas un ×2).
 */
export function isJoueurX2(bonusType: string | null, bonusPlayerId: string | null): boolean {
  return !!bonusPlayerId && bonusType !== 'troisieme_homme'
}

/**
 * Bloc « Bonus utilisé » réutilisable.
 * @param x2PlayerName  nom du joueur en ×2 (null si pas de bonus Joueur ×2)
 * @param bonusLabel    libellé déjà formaté du bonus de match (ex. « 🎯 Sniper +9 »),
 *                      null si aucun bonus de match
 * @param compact       version plus petite (listes denses type MatchPickRow)
 */
export function BonusMention({
  x2PlayerName,
  bonusLabel,
  compact = false,
}: {
  x2PlayerName: string | null
  bonusLabel: string | null
  compact?: boolean
}) {
  if (!x2PlayerName && !bonusLabel) return null

  const chip = compact
    ? 'text-[10px] px-1.5 py-0.5 rounded'
    : 'text-[11px] px-2 py-0.5 rounded-md'

  return (
    <div className="flex flex-wrap gap-1.5">
      {x2PlayerName && (
        <span className={`inline-flex items-center gap-1 ${chip} bg-yellow-950/30 border border-yellow-800/30 text-yellow-200 font-semibold`}>
          ⭐ Joueur ×2 : {x2PlayerName}
        </span>
      )}
      {bonusLabel && (
        <span className={`inline-flex items-center gap-1 ${chip} bg-violet-950/30 border border-violet-800/30 text-violet-300 font-semibold`}>
          {bonusLabel}
        </span>
      )}
    </div>
  )
}
