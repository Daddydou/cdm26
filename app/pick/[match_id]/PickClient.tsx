'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { savePick } from '@/app/actions/picks'
import { useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import Image from 'next/image'

// ─── Types ────────────────────────────────────────────────────────────────────

type Player = {
  id: string
  name: string
  position: string
  photo_url: string | null
  nation_id: string
}

type NationInfo = { id: string; name: string }

type MatchData = {
  id: string
  kickoff_at: string
  status: string
  home_nation: NationInfo
  away_nation: NationInfo
}

type ExistingPick = {
  home_player1_id?: string | null
  home_player2_id?: string | null
  away_player1_id?: string | null
  away_player2_id?: string | null
  home_sub_id?: string | null
  away_sub_id?: string | null
  star_player_id?: string | null
  active_bonus_id?: string | null
}

type BonusRecord = {
  id: string
  remaining_uses: number
  bonus: { id: string; name: string; description: string; icon: string } | null
}

// ─── Drapeaux ─────────────────────────────────────────────────────────────────

function isoFlag(code: string) {
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  )
}
const FLAGS: Record<string, string> = {
  'France': isoFlag('FR'), 'Brésil': isoFlag('BR'), 'Bresil': isoFlag('BR'),
  'Argentine': isoFlag('AR'), 'Espagne': isoFlag('ES'), 'Angleterre': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Allemagne': isoFlag('DE'), 'Portugal': isoFlag('PT'), 'Italie': isoFlag('IT'),
  'États-Unis': isoFlag('US'), 'Etats-Unis': isoFlag('US'), 'USA': isoFlag('US'),
  'Mexique': isoFlag('MX'), 'Canada': isoFlag('CA'), 'Maroc': isoFlag('MA'),
  'Japon': isoFlag('JP'), 'Corée du Sud': isoFlag('KR'), 'Australie': isoFlag('AU'),
  'Pays-Bas': isoFlag('NL'), 'Belgique': isoFlag('BE'), 'Croatie': isoFlag('HR'),
  'Suisse': isoFlag('CH'), 'Pologne': isoFlag('PL'), 'Serbie': isoFlag('RS'),
  'Danemark': isoFlag('DK'), 'Ukraine': isoFlag('UA'), 'Turquie': isoFlag('TR'),
  'Türkiye': isoFlag('TR'), 'Sénégal': isoFlag('SN'), 'Uruguay': isoFlag('UY'),
  'Colombie': isoFlag('CO'), 'Équateur': isoFlag('EC'), 'Pérou': isoFlag('PE'),
  'Chili': isoFlag('CL'), 'Nigeria': isoFlag('NG'), 'Cameroun': isoFlag('CM'),
  'Ghana': isoFlag('GH'), 'Tunisie': isoFlag('TN'), 'Algérie': isoFlag('DZ'),
  'Arabie Saoudite': isoFlag('SA'), 'Iran': isoFlag('IR'), 'Qatar': isoFlag('QA'),
  'Costa Rica': isoFlag('CR'), 'Honduras': isoFlag('HN'), 'Panama': isoFlag('PA'),
  'Écosse': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Pays de Galles': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Brazil': isoFlag('BR'), 'Argentina': isoFlag('AR'), 'Spain': isoFlag('ES'),
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Germany': isoFlag('DE'), 'Italy': isoFlag('IT'),
  'Netherlands': isoFlag('NL'), 'Belgium': isoFlag('BE'), 'Croatia': isoFlag('HR'),
  'Morocco': isoFlag('MA'), 'Japan': isoFlag('JP'), 'South Korea': isoFlag('KR'),
  'United States': isoFlag('US'), 'Mexico': isoFlag('MX'),
}
function getFlag(name: string) { return FLAGS[name] ?? '⚽' }

// ─── Constantes ───────────────────────────────────────────────────────────────

const POS_LABEL: Record<string, string> = { GK: 'GB', DEF: 'DEF', MID: 'MIL', FWD: 'ATT' }
const POS_COLOR: Record<string, string> = {
  GK: 'text-yellow-500', DEF: 'text-blue-400', MID: 'text-emerald-400', FWD: 'text-red-400',
}
const POS_SECTION: Record<string, string> = {
  GK: 'Gardiens', DEF: 'Défenseurs', MID: 'Milieux', FWD: 'Attaquants',
}

// ─── Submit button ─────────────────────────────────────────────────────────────

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-4 bg-green-500 hover:bg-green-400 active:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors text-sm tracking-wide shadow-lg shadow-green-900/40"
    >
      {pending ? 'Enregistrement…' : 'Valider mes picks ✓'}
    </button>
  )
}

// ─── Player card ──────────────────────────────────────────────────────────────

function PlayerCard({
  player, isSelected, isDisabled, onClick,
}: {
  player: Player
  isSelected: boolean
  isDisabled: boolean
  onClick: () => void
}) {
  const initials = player.name.split(' ').map(n => n[0]).slice(0, 2).join('')

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      className={[
        'w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all text-left',
        isSelected
          ? 'bg-green-950/50 border-green-600/70 shadow-[0_0_0_1px_theme(colors.green.600/30)]'
          : isDisabled
          ? 'bg-zinc-900/30 border-zinc-800/30 opacity-30 cursor-not-allowed'
          : 'bg-zinc-800/40 border-zinc-700/40 hover:border-zinc-500/60 hover:bg-zinc-800/70 cursor-pointer',
      ].join(' ')}
    >
      {/* Avatar */}
      <div className="w-6 h-6 rounded-full bg-zinc-700 flex-shrink-0 overflow-hidden flex items-center justify-center text-[9px] text-zinc-400 font-semibold">
        {player.photo_url
          ? <Image src={player.photo_url} alt={player.name} width={24} height={24} className="object-cover w-full h-full" />
          : initials
        }
      </div>

      {/* Nom */}
      <span className={`flex-1 text-[11px] truncate leading-tight ${isSelected ? 'text-zinc-100 font-semibold' : 'text-zinc-300'}`}>
        {player.name}
      </span>

      {/* Position */}
      <span className={`text-[9px] font-bold flex-shrink-0 ${POS_COLOR[player.position] ?? 'text-zinc-500'}`}>
        {POS_LABEL[player.position] ?? player.position}
      </span>

      {/* Check */}
      {isSelected && <span className="text-green-500 text-[10px] flex-shrink-0 ml-0.5">✓</span>}
    </button>
  )
}

// ─── Team column ──────────────────────────────────────────────────────────────

function TeamColumn({
  nation, players, selected, sub, usedIds,
  onToggle, onToggleSub, isReadOnly,
}: {
  nation: NationInfo
  players: Player[]
  selected: string[]
  sub: string | null
  usedIds: Set<string>
  onToggle: (id: string) => void
  onToggleSub: (id: string) => void
  isReadOnly: boolean
}) {
  const positions = ['GK', 'DEF', 'MID', 'FWD']
  const grouped = Object.fromEntries(
    positions.map(pos => [pos, players.filter(p => p.position === pos)])
  )
  const subCandidates = players.filter(p => !selected.includes(p.id))

  return (
    <div className="flex flex-col gap-3">
      {/* Header équipe */}
      <div className="text-center py-1">
        <div className="text-2xl leading-none">{getFlag(nation.name)}</div>
        <div className="text-[11px] font-bold text-zinc-200 mt-1 truncate">{nation.name}</div>
        <div className="text-[10px] text-zinc-600 mt-0.5">
          {selected.length}/2
          {selected.length === 2 && <span className="text-green-600 ml-1">✓</span>}
        </div>
      </div>

      {/* Groupes par position */}
      {positions.map(pos => {
        const group = grouped[pos] ?? []
        if (!group.length) return null
        return (
          <div key={pos}>
            <p className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-1 px-0.5">
              {POS_SECTION[pos]}
            </p>
            <div className="space-y-0.5">
              {group.map(player => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  isSelected={selected.includes(player.id)}
                  isDisabled={!isReadOnly && usedIds.has(player.id) && !selected.includes(player.id)}
                  onClick={() => onToggle(player.id)}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* Remplaçant */}
      <div>
        <p className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-1 px-0.5 flex items-center gap-1">
          Remplaçant {sub && <span className="text-green-600">✓</span>}
        </p>
        <div className="space-y-0.5">
          {subCandidates.map(player => (
            <PlayerCard
              key={player.id}
              player={player}
              isSelected={sub === player.id}
              isDisabled={false}
              onClick={() => onToggleSub(player.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PickClient({
  match, homePlayers, awayPlayers,
  existingPick, usedPlayerIds, userBonuses, isReadOnly,
}: {
  match: MatchData
  homePlayers: Player[]
  awayPlayers: Player[]
  existingPick: ExistingPick | null
  usedPlayerIds: string[]
  userBonuses: BonusRecord[]
  isReadOnly: boolean
}) {
  const [state, formAction] = useFormState(savePick, { error: null })

  const [homeSelected, setHomeSelected] = useState<string[]>(() =>
    [existingPick?.home_player1_id, existingPick?.home_player2_id].filter(Boolean) as string[]
  )
  const [awaySelected, setAwaySelected] = useState<string[]>(() =>
    [existingPick?.away_player1_id, existingPick?.away_player2_id].filter(Boolean) as string[]
  )
  const [homeSub, setHomeSub] = useState<string | null>(existingPick?.home_sub_id ?? null)
  const [awaySub, setAwaySub] = useState<string | null>(existingPick?.away_sub_id ?? null)
  const [starPlayer, setStarPlayer] = useState<string | null>(existingPick?.star_player_id ?? null)
  const [activeBonus, setActiveBonus] = useState<string | null>(existingPick?.active_bonus_id ?? null)

  const usedIds = new Set(usedPlayerIds)

  function toggleHome(id: string) {
    setHomeSelected(prev => {
      if (prev.includes(id)) { if (starPlayer === id) setStarPlayer(null); return prev.filter(x => x !== id) }
      return prev.length >= 2 ? [prev[0], id] : [...prev, id]
    })
  }

  function toggleAway(id: string) {
    setAwaySelected(prev => {
      if (prev.includes(id)) { if (starPlayer === id) setStarPlayer(null); return prev.filter(x => x !== id) }
      return prev.length >= 2 ? [prev[0], id] : [...prev, id]
    })
  }

  const canSubmit = homeSelected.length === 2 && awaySelected.length === 2
  const allMain = [...homePlayers, ...awayPlayers]
  const allSelectedIds = [...homeSelected, ...awaySelected]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/60">
        <div className="max-w-2xl mx-auto px-4 h-13 flex items-center gap-3 py-3">
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0">
            ← Retour
          </Link>
          <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0">
            <span className="text-lg leading-none">{getFlag(match.home_nation.name)}</span>
            <span className="text-xs font-bold text-zinc-200 truncate max-w-[72px]">{match.home_nation.name}</span>
            <span className="text-[10px] text-zinc-600 font-bold px-1">VS</span>
            <span className="text-xs font-bold text-zinc-200 truncate max-w-[72px]">{match.away_nation.name}</span>
            <span className="text-lg leading-none">{getFlag(match.away_nation.name)}</span>
          </div>
          <span className={[
            'flex-shrink-0 text-[10px] px-2 py-1 rounded-full font-semibold',
            isReadOnly ? 'bg-zinc-800 text-zinc-500' : 'bg-green-950 text-green-500',
          ].join(' ')}>
            {isReadOnly ? 'Fermé' : 'Ouvert'}
          </span>
        </div>
        <div className="text-center text-[11px] text-zinc-600 pb-2 capitalize">
          {format(new Date(match.kickoff_at), "EEEE d MMMM · HH'h'mm", { locale: fr })}
        </div>
      </header>

      <form action={isReadOnly ? undefined : formAction}>
        {/* Inputs cachés */}
        <input type="hidden" name="match_id"        value={match.id} />
        <input type="hidden" name="player_a1_id"    value={homeSelected[0] ?? ''} />
        <input type="hidden" name="player_a2_id"    value={homeSelected[1] ?? ''} />
        <input type="hidden" name="player_b1_id"    value={awaySelected[0] ?? ''} />
        <input type="hidden" name="player_b2_id"    value={awaySelected[1] ?? ''} />
        <input type="hidden" name="sub_a_id"        value={homeSub ?? ''} />
        <input type="hidden" name="sub_b_id"        value={awaySub ?? ''} />
        <input type="hidden" name="bonus_player_id" value={starPlayer ?? ''} />
        <input type="hidden" name="bonus_type"      value={activeBonus ?? ''} />

        <main className={`max-w-2xl mx-auto px-3 py-4 space-y-5 ${canSubmit && !isReadOnly ? 'pb-28' : 'pb-8'}`}>

          {/* ── Grille deux colonnes ── */}
          <div className="grid grid-cols-2 gap-3">
            <TeamColumn
              nation={match.home_nation}
              players={homePlayers}
              selected={homeSelected}
              sub={homeSub}
              usedIds={usedIds}
              onToggle={toggleHome}
              onToggleSub={id => setHomeSub(prev => prev === id ? null : id)}
              isReadOnly={isReadOnly}
            />
            <TeamColumn
              nation={match.away_nation}
              players={awayPlayers}
              selected={awaySelected}
              sub={awaySub}
              usedIds={usedIds}
              onToggle={toggleAway}
              onToggleSub={id => setAwaySub(prev => prev === id ? null : id)}
              isReadOnly={isReadOnly}
            />
          </div>

          {/* ── Joueur ×1.5 (étoile) ── */}
          {canSubmit && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-yellow-400 text-base">★</span>
                <span className="text-xs font-semibold text-zinc-200">Joueur ×1.5</span>
                <span className="text-[10px] text-zinc-600">— 1 seul parmi vos 4 sélections</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {allSelectedIds.map(id => {
                  const p = allMain.find(x => x.id === id)
                  if (!p) return null
                  const isStar = starPlayer === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setStarPlayer(prev => prev === id ? null : id)}
                      className={[
                        'flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all text-left',
                        isStar
                          ? 'bg-yellow-950/40 border-yellow-600/50'
                          : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600',
                      ].join(' ')}
                    >
                      <span className={`text-sm leading-none ${isStar ? 'text-yellow-400' : 'text-zinc-600'}`}>★</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] truncate font-medium ${isStar ? 'text-yellow-200' : 'text-zinc-300'}`}>{p.name}</p>
                        <p className={`text-[9px] ${POS_COLOR[p.position] ?? 'text-zinc-600'}`}>{POS_LABEL[p.position]}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Bonus disponibles ── */}
          {!isReadOnly && userBonuses.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🎯</span>
                <span className="text-xs font-semibold text-zinc-200">Bonus</span>
                <span className="text-[10px] text-zinc-600">— 1 seul activable par match</span>
              </div>
              <div className="space-y-2">
                {userBonuses.map(ub => {
                  const isActive = activeBonus === ub.id
                  return (
                    <button
                      key={ub.id}
                      type="button"
                      onClick={() => setActiveBonus(prev => prev === ub.id ? null : ub.id)}
                      className={[
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left',
                        isActive
                          ? 'bg-violet-950/40 border-violet-600/50'
                          : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600',
                      ].join(' ')}
                    >
                      <span className="text-xl flex-shrink-0">{ub.bonus?.icon ?? '🎁'}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${isActive ? 'text-violet-200' : 'text-zinc-200'}`}>
                          {ub.bonus?.name ?? 'Bonus'}
                        </p>
                        <p className="text-[10px] text-zinc-500 truncate">{ub.bonus?.description}</p>
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        <span className="text-[10px] text-zinc-500">×{ub.remaining_uses}</span>
                        {isActive && <span className="text-[10px] text-violet-400 font-bold">Activé</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Lecture seule ── */}
          {isReadOnly && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-zinc-500">
                {match.status !== 'a_venir'
                  ? 'Ce match est terminé — picks en lecture seule'
                  : 'Le match a commencé — picks verrouillés'}
              </p>
            </div>
          )}

        </main>

        {/* ── Footer fixe — bouton de validation ── */}
        {!isReadOnly && canSubmit && (
          <div className="fixed bottom-0 inset-x-0 z-30 bg-zinc-950/95 backdrop-blur-sm border-t border-zinc-800/80 px-4 pt-3 pb-5">
            <div className="max-w-2xl mx-auto space-y-2">
              {state?.error && (
                <p className="text-red-400 text-xs text-center">{state.error}</p>
              )}
              <SubmitButton />
            </div>
          </div>
        )}

      </form>
    </div>
  )
}
