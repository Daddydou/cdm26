-- Trigger : passe un match en 'termine' dès que les deux nations ont au moins
-- un joueur noté dans cdm_player_ratings, quelle que soit la méthode d'import.

CREATE OR REPLACE FUNCTION cdm_auto_terminate_match()
RETURNS TRIGGER AS $$
DECLARE
  v_nation_a_id uuid;
  v_nation_b_id uuid;
  v_count_a     int;
  v_count_b     int;
BEGIN
  SELECT nation_a_id, nation_b_id
  INTO v_nation_a_id, v_nation_b_id
  FROM cdm_matches
  WHERE id = NEW.match_id AND status = 'en_cours';

  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_count_a
  FROM cdm_player_ratings r
  JOIN cdm_players p ON p.id = r.player_id
  WHERE r.match_id = NEW.match_id AND p.nation_id = v_nation_a_id;

  SELECT COUNT(*) INTO v_count_b
  FROM cdm_player_ratings r
  JOIN cdm_players p ON p.id = r.player_id
  WHERE r.match_id = NEW.match_id AND p.nation_id = v_nation_b_id;

  IF v_count_a > 0 AND v_count_b > 0 THEN
    UPDATE cdm_matches SET status = 'termine' WHERE id = NEW.match_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_terminate_match
AFTER INSERT OR UPDATE ON cdm_player_ratings
FOR EACH ROW EXECUTE FUNCTION cdm_auto_terminate_match();
