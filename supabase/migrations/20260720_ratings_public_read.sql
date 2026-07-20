-- Lecture publique des notes de match.
--
-- cdm_player_ratings a RLS activé sans policy SELECT : le client anon comme le
-- client authentifié lisent 0 ligne, SANS erreur. Toute lecture qui oublie de
-- passer par le service role renvoie donc un tableau vide silencieux — piège
-- déjà rencontré, et qui touche aujourd'hui app/admin/notes/page.tsx (il lit
-- les notes existantes via le client serveur, et n'en voit aucune).
--
-- Les notes de match ne sont pas des données sensibles : elles sont déjà
-- rendues publiquement sur /, /resultats, /match/[id], /profil et /statistiques.
-- Les ouvrir en lecture supprime la classe de bugs ci-dessus et permet de
-- réserver le service role aux écritures administratives, meilleure ligne de
-- démarcation que « service role partout par réflexe ».
--
-- Écritures NON affectées : tous les chemins d'écriture de cdm_player_ratings
-- passent par le service role, qui contourne la RLS. Vérifié sur :
--   app/actions/admin.ts (saveRatings)
--   app/api/admin/save-ratings, import-ratings, fetch-ratings,
--   fetch-ratings-auto, import-from-browser
--   scripts/fetch-ratings-local.ts (clé service role explicite)
-- Aucune écriture par un client anon ou authenticated : aucune policy INSERT,
-- UPDATE ou DELETE n'est donc nécessaire. En l'absence de telles policies,
-- l'écriture reste refusée à anon et authenticated, ce qui est voulu.
--
-- Ne corrige PAS le plafond de 1000 lignes de PostgREST, qui est indépendant
-- et traité par lib/fetch-ratings.ts (pagination).

ALTER TABLE public.cdm_player_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lecture publique des notes" ON public.cdm_player_ratings;

CREATE POLICY "lecture publique des notes"
  ON public.cdm_player_ratings
  FOR SELECT
  TO anon, authenticated
  USING (true);
