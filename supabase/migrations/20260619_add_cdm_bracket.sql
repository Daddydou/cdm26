-- ── cdm_bracket : structure complète du bracket FIFA 2026 ─────────────────────

CREATE TABLE cdm_bracket (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_number          int         NOT NULL UNIQUE,
  round                 text        NOT NULL
                                    CHECK (round IN ('seizieme','huitieme','quart','demi','bronze','finale')),
  slot_description      text        NOT NULL,
  kickoff_at            timestamptz NOT NULL,
  cdm_match_id          uuid        REFERENCES cdm_matches(id),
  winner_goes_to_match  int,
  loser_goes_to_match   int,
  team_a_from_match     int,
  team_b_from_match     int,
  team_a_nation_id      uuid        REFERENCES cdm_nations(id),
  team_b_nation_id      uuid        REFERENCES cdm_nations(id),
  score_a               int,
  score_b               int,
  winner_nation_id      uuid        REFERENCES cdm_nations(id)
);

-- ── Seizièmes de finale M73–M88 ───────────────────────────────────────────────
INSERT INTO cdm_bracket
  (match_number, round, slot_description, kickoff_at, winner_goes_to_match)
VALUES
  (73, 'seizieme', '2e Groupe A vs 2e Groupe B',        '2026-06-28 21:00:00+00', 90),
  (74, 'seizieme', '1er Groupe E vs 3e (A/B/C/D/F)',    '2026-06-29 22:30:00+00', 89),
  (75, 'seizieme', '1er Groupe F vs 2e Groupe C',       '2026-06-30 03:00:00+00', 90),
  (76, 'seizieme', '1er Groupe C vs 2e Groupe F',       '2026-06-29 19:00:00+00', 91),
  (77, 'seizieme', '1er Groupe I vs 3e (C/D/F/G/H)',    '2026-06-29 23:00:00+00', 89),
  (78, 'seizieme', '2e Groupe E vs 2e Groupe I',        '2026-06-30 19:00:00+00', 91),
  (79, 'seizieme', '1er Groupe A vs 3e (C/E/F/H/I)',    '2026-07-01 03:00:00+00', 92),
  (80, 'seizieme', '1er Groupe L vs 3e (E/H/I/J/K)',    '2026-07-01 18:00:00+00', 92),
  (81, 'seizieme', '1er Groupe D vs 3e (B/E/F/I/J)',    '2026-07-02 02:00:00+00', 94),
  (82, 'seizieme', '1er Groupe G vs 3e (A/E/H/I/J)',    '2026-07-01 22:00:00+00', 94),
  (83, 'seizieme', '2e Groupe K vs 2e Groupe L',        '2026-07-03 01:00:00+00', 93),
  (84, 'seizieme', '1er Groupe H vs 2e Groupe J',       '2026-07-02 21:00:00+00', 93),
  (85, 'seizieme', '1er Groupe B vs 3e (E/F/G/I/J)',    '2026-07-03 05:00:00+00', 96),
  (86, 'seizieme', '1er Groupe J vs 2e Groupe H',       '2026-07-04 00:00:00+00', 95),
  (87, 'seizieme', '1er Groupe K vs 3e (D/E/I/J/L)',    '2026-07-04 03:30:00+00', 96),
  (88, 'seizieme', '2e Groupe D vs 2e Groupe G',        '2026-07-03 20:00:00+00', 95);

-- ── Huitièmes de finale M89–M96 ───────────────────────────────────────────────
INSERT INTO cdm_bracket
  (match_number, round, slot_description, kickoff_at, winner_goes_to_match, team_a_from_match, team_b_from_match)
VALUES
  (89,  'huitieme', 'Vainqueur M74 vs Vainqueur M77', '2026-07-04 23:00:00+00', 97,  74, 77),
  (90,  'huitieme', 'Vainqueur M73 vs Vainqueur M75', '2026-07-04 19:00:00+00', 97,  73, 75),
  (91,  'huitieme', 'Vainqueur M76 vs Vainqueur M78', '2026-07-05 22:00:00+00', 99,  76, 78),
  (92,  'huitieme', 'Vainqueur M79 vs Vainqueur M80', '2026-07-06 02:00:00+00', 99,  79, 80),
  (93,  'huitieme', 'Vainqueur M83 vs Vainqueur M84', '2026-07-06 21:00:00+00', 98,  83, 84),
  (94,  'huitieme', 'Vainqueur M81 vs Vainqueur M82', '2026-07-07 02:00:00+00', 98,  81, 82),
  (95,  'huitieme', 'Vainqueur M86 vs Vainqueur M88', '2026-07-07 18:00:00+00', 100, 86, 88),
  (96,  'huitieme', 'Vainqueur M85 vs Vainqueur M87', '2026-07-07 22:00:00+00', 100, 85, 87);

-- ── Quarts de finale M97–M100 ─────────────────────────────────────────────────
INSERT INTO cdm_bracket
  (match_number, round, slot_description, kickoff_at, winner_goes_to_match, team_a_from_match, team_b_from_match)
VALUES
  (97,  'quart', 'Vainqueur M89 vs Vainqueur M90', '2026-07-09 22:00:00+00', 101, 89, 90),
  (98,  'quart', 'Vainqueur M93 vs Vainqueur M94', '2026-07-10 21:00:00+00', 101, 93, 94),
  (99,  'quart', 'Vainqueur M91 vs Vainqueur M92', '2026-07-11 23:00:00+00', 102, 91, 92),
  (100, 'quart', 'Vainqueur M95 vs Vainqueur M96', '2026-07-12 03:00:00+00', 102, 95, 96);

-- ── Demi-finales M101–M102 ────────────────────────────────────────────────────
INSERT INTO cdm_bracket
  (match_number, round, slot_description, kickoff_at, winner_goes_to_match, loser_goes_to_match, team_a_from_match, team_b_from_match)
VALUES
  (101, 'demi', 'Vainqueur M97 vs Vainqueur M98',  '2026-07-14 21:00:00+00', 104, 103, 97,  98),
  (102, 'demi', 'Vainqueur M99 vs Vainqueur M100', '2026-07-15 21:00:00+00', 104, 103, 99, 100);

-- ── Match pour la 3e place M103 ───────────────────────────────────────────────
INSERT INTO cdm_bracket
  (match_number, round, slot_description, kickoff_at, team_a_from_match, team_b_from_match)
VALUES
  (103, 'bronze', 'Perdant M101 vs Perdant M102', '2026-07-18 23:00:00+00', 101, 102);

-- ── Finale M104 ───────────────────────────────────────────────────────────────
INSERT INTO cdm_bracket
  (match_number, round, slot_description, kickoff_at, team_a_from_match, team_b_from_match)
VALUES
  (104, 'finale', 'Vainqueur M101 vs Vainqueur M102', '2026-07-19 21:00:00+00', 101, 102);
