'use client'

import { useEffect, useState, useCallback } from 'react'
// createClient() = createBrowserClient(@supabase/ssr) — client public anon, identique aux autres pages 'use client'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'

// ─── Types ────────────────────────────────────────────────────────────────────

type BracketMatch = {
  id: string
  match_number: number
  round: string
  slot_description: string
  kickoff_at: string
  score_a: number | null
  score_b: number | null
  winner_nation_id: string | null
  team_a_nation_id: string | null
  team_b_nation_id: string | null
  team_a_from_match: number | null
  team_b_from_match: number | null
  winner_goes_to_match: number | null
  loser_goes_to_match: number | null
}

type Nation  = { id: string; name: string; code: string }
type CdmUser = { id: string; username: string; photo_url: string | null }

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCK_TIME = new Date('2026-06-28T21:00:00Z')

const ROUND_CONFIG = [
  { key: 'seizieme', label: 'Seizièmes de finale' },
  { key: 'huitieme', label: 'Huitièmes de finale' },
  { key: 'quart',    label: 'Quarts de finale' },
  { key: 'demi',     label: 'Demi-finales' },
  { key: 'finale',   label: 'Finale' },
  { key: 'bronze',   label: 'Match pour le bronze' },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function iso(code: string) {
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  )
}

function fmtDate(dateIso: string) {
  const d = new Date(dateIso)
  const day  = d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })
  return `${day} · ${time}`
}

// Résout la nation d'un slot (winner ou loser du match source, selon bracket)
function resolveNation(
  nationId: string | null | undefined,
  fromMatch: number | null | undefined,
  matchNumber: number,
  preds: Map<number, string>,
  matchMap: Map<number, BracketMatch>,
  nationMap: Map<string, Nation>
): Nation | null {
  if (nationId) return nationMap.get(nationId) ?? null
  if (!fromMatch) return null

  const src = matchMap.get(fromMatch)
  if (!src) return null

  const wantLoser = src.loser_goes_to_match === matchNumber

  if (!wantLoser) {
    // On veut le vainqueur du match source
    if (src.winner_nation_id) return nationMap.get(src.winner_nation_id) ?? null
    const predId = preds.get(fromMatch)
    if (predId) return nationMap.get(predId) ?? null
    return null
  }

  // On veut le perdant du match source (match pour le bronze)
  if (src.winner_nation_id && src.team_a_nation_id && src.team_b_nation_id) {
    const loserId = src.winner_nation_id === src.team_a_nation_id
      ? src.team_b_nation_id
      : src.team_a_nation_id
    return nationMap.get(loserId) ?? null
  }
  const predWinnerId = preds.get(fromMatch)
  if (!predWinnerId) return null
  const tA = resolveNation(src.team_a_nation_id, src.team_a_from_match, fromMatch, preds, matchMap, nationMap)
  const tB = resolveNation(src.team_b_nation_id, src.team_b_from_match, fromMatch, preds, matchMap, nationMap)
  if (tA && tA.id !== predWinnerId) return tA
  if (tB && tB.id !== predWinnerId) return tB
  return null
}

// ─── TeamButton ───────────────────────────────────────────────────────────────

function TeamButton({
  nation,
  isSelected,
  isRealWinner,
  isFinished,
  disabled,
  onClick,
}: {
  nation: Nation | null
  isSelected: boolean
  isRealWinner: boolean
  isFinished: boolean
  disabled: boolean
  onClick: () => void
}) {
  let cls = 'flex-1 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left truncate border '
  if (isFinished) {
    cls += isRealWinner
      ? 'bg-green-900/40 border-green-700/50 text-green-200'
      : 'bg-zinc-800/30 border-zinc-700/20 text-zinc-600'
  } else if (isSelected) {
    cls += 'bg-blue-900/40 border-blue-600/60 text-blue-200 ring-1 ring-blue-600/50'
  } else {
    cls += disabled
      ? 'bg-zinc-800/50 border-zinc-700/30 text-zinc-500 cursor-default'
      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 cursor-pointer'
  }

  return (
    <button className={cls} disabled={disabled} onClick={onClick} type="button">
      {nation ? `${iso(nation.code)} ${nation.name}` : '?'}
    </button>
  )
}

// ─── MatchCard ────────────────────────────────────────────────────────────────

function MatchCard({
  match,
  teamA,
  teamB,
  prediction,
  isLocked,
  readonly,
  onPredict,
}: {
  match: BracketMatch
  teamA: Nation | null
  teamB: Nation | null
  prediction: string | null
  isLocked: boolean
  readonly: boolean
  onPredict: (nationId: string) => void
}) {
  const isFinished = match.score_a !== null && match.score_b !== null
  const isCorrect  = !!(prediction && isFinished && prediction === match.winner_nation_id)
  const isWrong    = !!(prediction && isFinished && prediction !== match.winner_nation_id)
  const teamsKnown = !!teamA && !!teamB
  const cantPick   = isLocked || readonly || !teamsKnown

  const predictedNation = prediction === teamA?.id ? teamA
    : prediction === teamB?.id ? teamB
    : null

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-zinc-500">M{match.match_number}</span>
        <span className="text-[10px] text-zinc-600">{fmtDate(match.kickoff_at)}</span>
      </div>

      <div className="flex items-center gap-2">
        <TeamButton
          nation={teamA}
          isSelected={prediction === teamA?.id}
          isRealWinner={isFinished && match.winner_nation_id === teamA?.id}
          isFinished={isFinished}
          disabled={cantPick}
          onClick={() => teamA && onPredict(teamA.id)}
        />
        <span className="text-zinc-600 text-[10px] flex-shrink-0">vs</span>
        <TeamButton
          nation={teamB}
          isSelected={prediction === teamB?.id}
          isRealWinner={isFinished && match.winner_nation_id === teamB?.id}
          isFinished={isFinished}
          disabled={cantPick}
          onClick={() => teamB && onPredict(teamB.id)}
        />
      </div>

      {isFinished && (
        <p className="text-xs font-bold text-green-400">
          Score réel : {match.score_a} – {match.score_b}
        </p>
      )}

      {prediction && predictedNation && (
        <p className={`text-[10px] font-semibold ${isCorrect ? 'text-green-400' : isWrong ? 'text-red-400' : 'text-zinc-400'}`}>
          {isCorrect
            ? `✅ Bonne prédiction — ${predictedNation.name}`
            : isWrong
            ? `❌ Mauvaise prédiction — ${predictedNation.name}`
            : `→ ${readonly ? 'Prédiction' : 'Ta prédiction'} : ${predictedNation.name}`}
        </p>
      )}

      {!teamsKnown && !isFinished && (
        <p className="text-[10px] text-zinc-600 italic">{match.slot_description}</p>
      )}
    </div>
  )
}

// ─── RoundSection ─────────────────────────────────────────────────────────────

function RoundSection({
  label,
  matches,
  matchMap,
  nationMap,
  preds,
  isLocked,
  readonly,
  onPredict,
}: {
  label: string
  matches: BracketMatch[]
  matchMap: Map<number, BracketMatch>
  nationMap: Map<string, Nation>
  preds: Map<number, string>
  isLocked: boolean
  readonly: boolean
  onPredict: (matchNumber: number, nationId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const completedCount = matches.filter(m => preds.has(m.match_number)).length
  const isComplete     = matches.length > 0 && completedCount === matches.length

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800/70 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-zinc-200">{label}</span>
          <span className="text-[10px] text-zinc-600 font-mono tabular-nums">
            {completedCount}/{matches.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isComplete && (
            <span className="text-[10px] font-semibold text-green-400 bg-green-950/40 border border-green-800/40 rounded-full px-2 py-0.5">
              Complet ✅
            </span>
          )}
          <span className="text-zinc-500 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="bg-zinc-950/60 border-t border-zinc-800 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {matches.map(match => {
            const tA = resolveNation(match.team_a_nation_id, match.team_a_from_match, match.match_number, preds, matchMap, nationMap)
            const tB = resolveNation(match.team_b_nation_id, match.team_b_from_match, match.match_number, preds, matchMap, nationMap)
            return (
              <MatchCard
                key={match.id}
                match={match}
                teamA={tA}
                teamB={tB}
                prediction={preds.get(match.match_number) ?? null}
                isLocked={isLocked}
                readonly={readonly}
                onPredict={nationId => onPredict(match.match_number, nationId)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── BracketAccordion ─────────────────────────────────────────────────────────

function BracketAccordion({
  matches,
  matchMap,
  nationMap,
  preds,
  isLocked,
  readonly,
  onPredict,
}: {
  matches: BracketMatch[]
  matchMap: Map<number, BracketMatch>
  nationMap: Map<string, Nation>
  preds: Map<number, string>
  isLocked: boolean
  readonly: boolean
  onPredict: (matchNumber: number, nationId: string) => void
}) {
  return (
    <div className="space-y-2">
      {ROUND_CONFIG.map(({ key, label }) => {
        const roundMatches = matches.filter(m => m.round === key)
        if (!roundMatches.length) return null
        return (
          <RoundSection
            key={key}
            label={label}
            matches={roundMatches}
            matchMap={matchMap}
            nationMap={nationMap}
            preds={preds}
            isLocked={isLocked}
            readonly={readonly}
            onPredict={onPredict}
          />
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BracketPage() {
  // userLoading n'est PAS dans la gate de rendu : l'auth peut être lente sans bloquer l'affichage
  const { cdmUser } = useUser()

  const [matches,        setMatches]        = useState<BracketMatch[]>([])
  const [nationMap,      setNationMap]      = useState<Map<string, Nation>>(new Map())
  const [cdmUsers,       setCdmUsers]       = useState<CdmUser[]>([])
  const [allPreds,       setAllPreds]       = useState<Record<string, Record<number, string>>>({})
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [activeTab,      setActiveTab]      = useState<'mine' | 'others'>('mine')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const isLocked = new Date() >= LOCK_TIME
  const matchMap = new Map(matches.map(m => [m.match_number, m]))

  useEffect(() => {
    console.log('[bracket] useEffect déclenché')
    const sb = createClient()
    console.log('[bracket] client créé:', sb)
    sb.from('cdm_bracket').select('count').then(res => {
      console.log('[bracket] résultat:', res)
      setLoading(false)
    })
  }, [])

  const savePrediction = useCallback(async (matchNumber: number, nationId: string) => {
    if (!cdmUser || isLocked || saving) return
    setSaving(true)
    const sb = createClient()
    const { error } = await sb
      .from('cdm_bracket_predictions')
      .upsert(
        { user_id: cdmUser.id, match_number: matchNumber, predicted_winner_nation_id: nationId },
        { onConflict: 'user_id,match_number' }
      )
    if (!error) {
      setAllPreds(prev => ({
        ...prev,
        [cdmUser.id]: { ...(prev[cdmUser.id] ?? {}), [matchNumber]: nationId },
      }))
    }
    setSaving(false)
  }, [cdmUser, isLocked, saving])

  const myPredsMap: Map<number, string> = new Map(
    cdmUser
      ? Object.entries(allPreds[cdmUser.id] ?? {}).map(([k, v]) => [parseInt(k), v])
      : []
  )
  const viewPredsMap: Map<number, string> = new Map(
    selectedUserId
      ? Object.entries(allPreds[selectedUserId] ?? {}).map(([k, v]) => [parseInt(k), v])
      : []
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/60">
        <div className="max-w-lg mx-auto flex items-center px-4 h-14">
          <h1 className="text-base font-bold tracking-tight">
            CDM<span className="text-green-500">26</span>
            <span className="ml-2 text-zinc-500 font-normal text-sm">· Bracket</span>
          </h1>
          {saving && (
            <span className="ml-auto text-[10px] text-zinc-500 animate-pulse">Sauvegarde…</span>
          )}
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="sticky top-14 z-10 bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-800/50">
        <div className="max-w-lg mx-auto px-4 flex gap-1.5 py-2">
          {(['mine', 'others'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                'px-4 py-1.5 rounded-full text-xs font-semibold transition-colors',
                activeTab === tab
                  ? 'bg-green-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200',
              ].join(' ')}
            >
              {tab === 'mine' ? 'Mon Bracket' : 'Brackets des participants'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-4">

        {loading ? (
          <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
            Chargement…
          </div>
        ) : activeTab === 'mine' ? (
          <>
            {isLocked && (
              <div className="bg-orange-950/40 border border-orange-800/50 rounded-xl px-4 py-3 text-sm font-semibold text-orange-300">
                🔒 Bracket verrouillé — Les prédictions ne peuvent plus être modifiées
              </div>
            )}

            {!cdmUser && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-6 text-center">
                <p className="text-sm text-zinc-400">Connectez-vous pour saisir vos pronostics</p>
              </div>
            )}

            <BracketAccordion
              matches={matches}
              matchMap={matchMap}
              nationMap={nationMap}
              preds={myPredsMap}
              isLocked={isLocked || !cdmUser}
              readonly={false}
              onPredict={savePrediction}
            />
          </>
        ) : (
          <>
            {cdmUsers.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {cdmUsers.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={[
                      'px-4 py-1.5 rounded-full text-xs font-semibold transition-colors border',
                      selectedUserId === u.id
                        ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200',
                    ].join(' ')}
                  >
                    {u.username}
                  </button>
                ))}
              </div>
            )}

            {selectedUserId && (
              <BracketAccordion
                matches={matches}
                matchMap={matchMap}
                nationMap={nationMap}
                preds={viewPredsMap}
                isLocked={isLocked}
                readonly
                onPredict={() => {}}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
