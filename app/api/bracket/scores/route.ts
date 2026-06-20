import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ROUND_POINTS: Record<string, number> = {
  seizieme: 1,
  huitieme: 2,
  quart:    4,
  demi:     8,
  bronze:   4,
  finale:   16,
}

export async function GET() {
  const supabase = createAdminClient()

  const [matchesRes, predsRes, usersRes] = await Promise.all([
    supabase
      .from('cdm_bracket')
      .select('match_number, round, score_a, score_b, winner_nation_id')
      .not('winner_nation_id', 'is', null),
    supabase
      .from('cdm_bracket_predictions')
      .select('user_id, match_number, predicted_winner_nation_id, predicted_score_a, predicted_score_b'),
    supabase
      .from('cdm_users')
      .select('id, username, photo_url'),
  ])

  const matches = matchesRes.data ?? []
  const predictions = predsRes.data ?? []
  const users = usersRes.data ?? []

  const matchMap = new Map(matches.map(m => [m.match_number, m]))

  type Score = { userId: string; username: string; photo_url: string | null; points: number; correct: number }
  const scores = new Map<string, Score>()
  for (const u of users) {
    scores.set(u.id, { userId: u.id, username: u.username, photo_url: u.photo_url, points: 0, correct: 0 })
  }

  for (const pred of predictions) {
    const match = matchMap.get(pred.match_number)
    if (!match || !scores.has(pred.user_id)) continue

    const entry = scores.get(pred.user_id)!
    if (pred.predicted_winner_nation_id === match.winner_nation_id) {
      const base = ROUND_POINTS[match.round] ?? 1
      const exact =
        pred.predicted_score_a === match.score_a &&
        pred.predicted_score_b === match.score_b
      entry.points += exact ? Math.round(base * 1.5) : base
      entry.correct++
    }
  }

  const ranked = [...scores.values()].sort((a, b) => b.points - a.points)
  return NextResponse.json({ scores: ranked })
}
