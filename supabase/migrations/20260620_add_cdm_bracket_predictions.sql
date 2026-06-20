-- cdm_bracket_predictions : prédictions de bracket par participant

CREATE TABLE cdm_bracket_predictions (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid        NOT NULL REFERENCES cdm_users(id) ON DELETE CASCADE,
  match_number                int         NOT NULL REFERENCES cdm_bracket(match_number) ON DELETE CASCADE,
  predicted_winner_nation_id  uuid        NOT NULL REFERENCES cdm_nations(id),
  predicted_score_a           int,
  predicted_score_b           int,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_number)
);

CREATE INDEX idx_cdm_bracket_predictions_user ON cdm_bracket_predictions(user_id);

ALTER TABLE cdm_bracket_predictions ENABLE ROW LEVEL SECURITY;

-- Lecture publique (pour l'onglet "Brackets des participants")
CREATE POLICY "bracket_preds_select" ON cdm_bracket_predictions
  FOR SELECT USING (true);

-- INSERT / UPDATE / DELETE : seulement ses propres prédictions
CREATE POLICY "bracket_preds_insert" ON cdm_bracket_predictions
  FOR INSERT WITH CHECK (
    user_id = (SELECT id FROM cdm_users WHERE auth_id = auth.uid())
  );

CREATE POLICY "bracket_preds_update" ON cdm_bracket_predictions
  FOR UPDATE USING (
    user_id = (SELECT id FROM cdm_users WHERE auth_id = auth.uid())
  );

CREATE POLICY "bracket_preds_delete" ON cdm_bracket_predictions
  FOR DELETE USING (
    user_id = (SELECT id FROM cdm_users WHERE auth_id = auth.uid())
  );
