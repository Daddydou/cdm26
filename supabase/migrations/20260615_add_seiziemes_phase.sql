-- ── 1. Nouveau membre d'enum ──────────────────────────────────────────────────
ALTER TYPE match_phase ADD VALUE 'seiziemes';

-- ── 2. Migration des données (ordre impératif : a avant b) ────────────────────

-- a. huitiemes → seiziemes  (16 matchs 28/06 – 05/07 = 16es de finale)
UPDATE cdm_matches
SET phase = 'seiziemes'
WHERE phase = 'huitiemes';

-- b. quarts ≤ 09/07 → huitiemes  (8 matchs 06/07 – 09/07 = 8es de finale)
UPDATE cdm_matches
SET phase = 'huitiemes'
WHERE phase = 'quarts' AND kickoff_at::date <= '2026-07-09';

-- c. 4 matchs quarts (11–13/07) restent en 'quarts' ✓

-- ── 3. Correction des multiplicateurs ─────────────────────────────────────────
-- seiziemes=1.2 ✓  huitiemes=1.4 ✓  finale=2.0 ✓  → déjà corrects
UPDATE cdm_matches SET points_multiplier = 1.6 WHERE phase = 'quarts';
UPDATE cdm_matches SET points_multiplier = 1.8 WHERE phase = 'demis';
UPDATE cdm_matches SET points_multiplier = 1.8 WHERE phase = 'finale_3eme';
