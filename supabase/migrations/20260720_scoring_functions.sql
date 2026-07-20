-- Scoring des picks : source de vérité unique.
--
-- Depuis le refactor bcc51db, app/actions/admin.ts (computeMatchPoints) ne
-- contient plus aucune règle de calcul : il appelle compute_pick_points via
-- supabase.rpc() pour chaque pick du match. Le code TypeScript dépend donc
-- directement de cette fonction — sans elle, le bouton « Calculer » de
-- /admin/matchs et l'import de notes échouent.
--
-- Écritures assurées ici, à ne pas dupliquer côté applicatif :
--   * compute_pick_points écrit elle-même cdm_picks.points_bruts et points_finaux
--   * trg_sync_total_points resynchronise cdm_users.total_points à chaque
--     INSERT / UPDATE / DELETE sur cdm_picks
--
-- Règles de bonus implémentées (10) :
--   bouclier        plancher de la note à 5, appliqué avant le ×2
--   sniper          +3 par but, par joueur, avant le ×2
--   passeur_genie   +3 par passe décisive, par joueur, avant le ×2
--   mur             +5 par joueur ayant arrêté un penalty, avant le ×2
--   joueur ×2       note doublée si bonus_player_id est renseigné et que
--                   bonus_type n'est pas 'troisieme_homme'
--   troisieme_homme note d'un 5e joueur ajoutée ; source bonus_player_id,
--                   repli sur bonus_data->>'player_id'
--   all_in          mise = bonus_data->>'mise' ; moyenne des 4 joueurs du pick
--                   comparée à la moyenne de tous les joueurs notés du match ;
--                   ajoutée si supérieure, retirée sinon ; pas de plancher,
--                   le total peut devenir négatif
--   double_mise     total ×2
--   espion          aucun effet sur le score
--   multiplicateur  total × cdm_matches.points_multiplier, en dernier

-- ─── compute_pick_points ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.compute_pick_points(p_pick_id uuid)
 RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_pick public.cdm_picks%rowtype;
  v_match public.cdm_matches%rowtype;
  v_total numeric := 0;
  v_rating numeric; v_player_ids uuid[]; v_pid uuid;
  v_third numeric; v_third_id uuid; v_mise numeric;
  v_moy_pick numeric; v_moy_match numeric; v_goals int; v_assists int;
begin
  select * into v_pick from public.cdm_picks where id = p_pick_id;
  select * into v_match from public.cdm_matches where id = v_pick.match_id;
  v_player_ids := array_remove(array[v_pick.player_a1_id, v_pick.player_a2_id, v_pick.player_b1_id, v_pick.player_b2_id], null);
  foreach v_pid in array v_player_ids loop
    v_rating := coalesce((select coalesce(fotmob_rating,0) from public.cdm_player_ratings where match_id=v_pick.match_id and player_id=v_pid limit 1), 0);
    if v_pick.bonus_type = 'bouclier' and v_rating < 5 then v_rating := 5; end if;
    if v_pick.bonus_type = 'sniper' then
      v_goals := coalesce((select goals from public.cdm_player_ratings where match_id=v_pick.match_id and player_id=v_pid limit 1), 0);
      v_rating := v_rating + 3 * v_goals;
    end if;
    if v_pick.bonus_type = 'passeur_genie' then
      v_assists := coalesce((select assists from public.cdm_player_ratings where match_id=v_pick.match_id and player_id=v_pid limit 1), 0);
      v_rating := v_rating + 3 * v_assists;
    end if;
    if v_pick.bonus_type = 'mur' then
      if coalesce((select penalty_saved from public.cdm_player_ratings where match_id=v_pick.match_id and player_id=v_pid limit 1), false) then v_rating := v_rating + 5; end if;
    end if;
    if v_pick.bonus_type is distinct from 'troisieme_homme' and v_pick.bonus_player_id is not null and v_pid = v_pick.bonus_player_id then
      v_rating := v_rating * 2.0;
    end if;
    v_total := v_total + v_rating;
  end loop;
  if v_pick.bonus_type = 'troisieme_homme' then
    v_third_id := coalesce(v_pick.bonus_player_id, (v_pick.bonus_data->>'player_id')::uuid);
    if v_third_id is not null then
      v_third := coalesce((select coalesce(fotmob_rating,0) from public.cdm_player_ratings where match_id=v_pick.match_id and player_id=v_third_id limit 1), 0);
      v_total := v_total + v_third;
    end if;
  end if;
  if v_pick.bonus_type = 'all_in' then
    v_mise := coalesce((v_pick.bonus_data->>'mise')::numeric, 0);
    select coalesce(avg(coalesce(r.fotmob_rating,0)),0) into v_moy_pick from unnest(v_player_ids) as pid left join public.cdm_player_ratings r on r.match_id=v_pick.match_id and r.player_id=pid;
    select coalesce(avg(fotmob_rating),0) into v_moy_match from public.cdm_player_ratings where match_id=v_pick.match_id;
    if v_moy_pick > v_moy_match then v_total := v_total + v_mise; else v_total := v_total - v_mise; end if;
  end if;
  if v_pick.bonus_type = 'double_mise' then v_total := v_total * 2; end if;
  v_total := coalesce(v_total,0) * coalesce(v_match.points_multiplier,1);
  update public.cdm_picks set points_bruts = v_total / nullif(coalesce(v_match.points_multiplier,1),0), points_finaux = v_total where id = p_pick_id;
  return v_total;
end; $function$;

-- ─── sync_user_total_points ───────────────────────────────────────────────────

-- Ne somme que les picks des matchs 'termine' : un match en cours dont les
-- points seraient déjà calculés ne compte donc pas dans total_points tant que
-- son statut n'a pas basculé.

CREATE OR REPLACE FUNCTION public.sync_user_total_points()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
declare
  v_user uuid;
begin
  v_user := coalesce(NEW.user_id, OLD.user_id);
  update cdm_users u
  set total_points = coalesce((
    select sum(p.points_finaux)
    from cdm_picks p
    join cdm_matches m on m.id = p.match_id
    where p.user_id = v_user and m.status = 'termine'
  ), 0)
  where u.id = v_user;
  return coalesce(NEW, OLD);
end; $function$;

-- ─── trg_sync_total_points ────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_sync_total_points ON public.cdm_picks;

CREATE TRIGGER trg_sync_total_points
AFTER INSERT OR DELETE OR UPDATE ON public.cdm_picks
FOR EACH ROW EXECUTE FUNCTION sync_user_total_points();
