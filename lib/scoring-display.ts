/**
 * Note effective d'un joueur telle qu'elle entre dans le calcul.
 *
 * Miroir d'affichage de la règle « bouclier » de la fonction SQL
 * compute_pick_points (cf. supabase/migrations/20260720_scoring_functions.sql) :
 *
 *   v_rating := coalesce(fotmob_rating, 0);
 *   if bonus_type = 'bouclier' and v_rating < 5 then v_rating := 5; end if;
 *
 * Une note absente vaut donc 0, et se retrouve remontée à 5 sous bouclier.
 * Le plancher s'applique AVANT le ×2 joueur : un joueur à la fois remonté et
 * doublé s'affiche à 5, le doublement étant signalé par son propre badge ⭐.
 *
 * N'affecte que l'affichage du pick concerné — le bouclier est un effet
 * personnel, la note en base reste inchangée pour les autres joueurs.
 *
 * @param matchHasRatings faux tant que le match n'a aucune note importée, pour
 *   éviter d'afficher 5 partout sur un match non joué.
 */
export function effectiveRating(
  rawRating: number | null | undefined,
  bonusType: string | null | undefined,
  matchHasRatings: boolean,
): { value: number | null; shielded: boolean } {
  const raw = rawRating ?? null
  if (bonusType !== 'bouclier' || !matchHasRatings) return { value: raw, shielded: false }
  if ((raw ?? 0) < 5) return { value: 5, shielded: true }
  return { value: raw, shielded: false }
}

/** Classe de couleur d'une note affichée, avec teinte dédiée aux notes remontées. */
export function ratingColorClass(value: number, shielded: boolean): string {
  if (shielded) return 'text-sky-300'
  if (value >= 7) return 'text-green-400'
  if (value >= 5) return 'text-zinc-400'
  return 'text-red-400'
}
