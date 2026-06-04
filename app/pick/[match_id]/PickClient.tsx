'use client'

import { useState, useTransition } from 'react'
import { savePick } from '@/app/actions/picks'
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

// ─── Constantes positions ─────────────────────────────────────────────────────

const POS_LABEL: Record<string, string>  = { GK: 'GB',  DEF: 'DEF', MID: 'MIL', FWD: 'ATT' }
const POS_COLOR: Record<string, string>  = { GK: 'text-yellow-500', DEF: 'text-blue-400', MID: 'text-emerald-400', FWD: 'text-red-400' }
const POS_TITLE: Record<string, string>  = { GK: 'Gardiens', DEF: 'Défenseurs', MID: 'Milieux', FWD: 'Attaquants' }

// ─── Descriptions bonus ───────────────────────────────────────────────────────

const BONUS_DESC: Record<string, string> = {
  double_mise:    'Vos points totaux ce match seront ×2',
  bouclier:       'Les notes inférieures à 5 seront remontées à 5',
  sniper:         "Si un de vos joueurs marque, +3 pts",
  passeur_genie:  "Si un de vos joueurs fait une passe décisive, +3 pts",
  mur:            "Si votre gardien arrête un pénalty, +5 pts",
  capitaine_bis:  'Votre joueur bonus sera ×2 au lieu de ×1.5',
  espion:         'Vous verrez les picks des autres participants avant le début du match',
}

// ─── PlayerCard ───────────────────────────────────────────────────────────────

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
        'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left',
        isSelected
          ? 'bg-green-950/60 border-green-600/80 ring-1 ring-green-600/20'
          : isDisabled
          ? 'opacity-25 bg-zinc-900/20 border-zinc-800/30 cursor-not-allowed'
          : 'bg-zinc-900/50 border-zinc-800/60 hover:border-zinc-600 hover:bg-zinc-800/60 active:bg-zinc-800 cursor-pointer',
      ].join(' ')}
    >
      <div className="w-7 h-7 rounded-full bg-zinc-800 flex-shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-semibold text-zinc-500">
        {player.photo_url
          ? <Image src={player.photo_url} alt={player.name} width={28} height={28} className="object-cover w-full h-full" />
          : initials
        }
      </div>
      <span className={`flex-1 text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
        {player.name}
      </span>
      <span className={`text-[10px] font-bold flex-shrink-0 ${POS_COLOR[player.position] ?? 'text-zinc-500'}`}>
        {POS_LABEL[player.position] ?? player.position}
      </span>
      {isSelected && <span className="text-green-500 text-sm flex-shrink-0 ml-0.5">✓</span>}
    </button>
  )
}

// ─── TeamSection ──────────────────────────────────────────────────────────────

function TeamSection({
  nation, players, selected, sub, usedIds, isReadOnly, onToggle, onToggleSub,
}: {
  nation: NationInfo
  players: Player[]
  selected: string[]
  sub: string | null
  usedIds: Set<string>
  isReadOnly: boolean
  onToggle: (id: string) => void
  onToggleSub: (id: string) => void
}) {
  const POSITIONS = ['GK', 'DEF', 'MID', 'FWD']
  const grouped = Object.fromEntries(POSITIONS.map(p => [p, players.filter(pl => pl.position === p)]))
  const subCandidates = players.filter(p => !selected.includes(p.id))

  return (
    <section className="px-4 py-5 border-b border-zinc-800/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">{getFlag(nation.name)}</span>
          <div>
            <h2 className="text-sm font-bold text-zinc-100 leading-tight">{nation.name}</h2>
            <p className={`text-xs mt-0.5 transition-colors ${selected.length === 2 ? 'text-green-500' : 'text-zinc-500'}`}>
              {selected.length}/2 sélectionnés{selected.length === 2 ? ' ✓' : ''}
            </p>
          </div>
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end max-w-[150px]">
            {selected.map(id => {
              const p = players.find(x => x.id === id)
              return p ? (
                <span key={id} className="text-[10px] bg-green-950/60 text-green-400 border border-green-800/40 px-1.5 py-0.5 rounded-md truncate max-w-[70px]">
                  {p.name.split(' ').slice(-1)[0]}
                </span>
              ) : null
            })}
          </div>
        )}
      </div>

      {/* Joueurs groupés par position */}
      <div className="space-y-4">
        {POSITIONS.map(pos => {
          const group = grouped[pos] ?? []
          if (!group.length) return null
          return (
            <div key={pos}>
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2">
                {POS_TITLE[pos]}
              </p>
              <div className="space-y-1.5">
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
      </div>

      {/* Remplaçant */}
      {!isReadOnly && (
        <div className="mt-5 pt-4 border-t border-zinc-800/40">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            Remplaçant
            {sub && <span className="text-green-600 text-xs">✓</span>}
            <span className="text-zinc-700 normal-case font-normal tracking-normal">— optionnel</span>
          </p>
          <div className="space-y-1.5">
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
      )}
    </section>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PickClient({
  match, playersA, playersB, existingPick, usedPlayerIds, userBonuses, isReadOnly,
}: {
  match: MatchData
  playersA: Player[]
  playersB: Player[]
  existingPick: ExistingPick | null
  usedPlayerIds: string[]
  userBonuses: BonusRecord[]
  isReadOnly: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Sélections principales
  const [selA, setSelA] = useState<string[]>(() =>
    [existingPick?.home_player1_id, existingPick?.home_player2_id].filter(Boolean) as string[]
  )
  const [selB, setSelB] = useState<string[]>(() =>
    [existingPick?.away_player1_id, existingPick?.away_player2_id].filter(Boolean) as string[]
  )
  const [subA, setSubA] = useState<string | null>(existingPick?.home_sub_id ?? null)
  const [subB, setSubB] = useState<string | null>(existingPick?.away_sub_id ?? null)

  // Joueur bonus ×1.5
  const [bonusPlayer, setBonusPlayer] = useState<string | null>(existingPick?.star_player_id ?? null)

  // Bonus de match
  const [activeBonusId, setActiveBonusId] = useState<string | null>(existingPick?.active_bonus_id ?? null)
  const [troisHommePlayer, setTroisHommePlayer] = useState<string | null>(null)
  const [allInAmount, setAllInAmount] = useState(5)

  // Dérivés
  const usedIds = new Set(usedPlayerIds)
  const canSubmit = selA.length === 2 && selB.length === 2
  const allSelectedIds = [...selA, ...selB]
  const allPlayers = [...playersA, ...playersB]
  const remaining = (2 - selA.length) + (2 - selB.length)

  const activeBonus = userBonuses.find(ub => ub.id === activeBonusId)
  const activeBonusType = activeBonus?.bonus?.id ?? null

  // ── Handlers ──

  function toggleSelA(id: string) {
    setSelA(prev => {
      if (prev.includes(id)) { if (bonusPlayer === id) setBonusPlayer(null); return prev.filter(x => x !== id) }
      const next = prev.length >= 2 ? [prev[1], id] : [...prev, id]
      return next
    })
  }

  function toggleSelB(id: string) {
    setSelB(prev => {
      if (prev.includes(id)) { if (bonusPlayer === id) setBonusPlayer(null); return prev.filter(x => x !== id) }
      return prev.length >= 2 ? [prev[1], id] : [...prev, id]
    })
  }

  function toggleActiveBonus(id: string) {
    setActiveBonusId(prev => {
      if (prev === id) { setTroisHommePlayer(null); return null }
      setTroisHommePlayer(null)
      return id
    })
  }

  function handleSubmit() {
    if (!canSubmit || isPending || isReadOnly) return
    setError(null)

    const bonusData: Record<string, unknown> = {}
    if (activeBonusType === 'troisieme_homme' && troisHommePlayer) bonusData.player_id = troisHommePlayer
    if (activeBonusType === 'all_in') bonusData.amount = allInAmount

    startTransition(async () => {
      const fd = new FormData()
      fd.set('match_id',        match.id)
      fd.set('player_a1_id',    selA[0] ?? '')
      fd.set('player_a2_id',    selA[1] ?? '')
      fd.set('player_b1_id',    selB[0] ?? '')
      fd.set('player_b2_id',    selB[1] ?? '')
      fd.set('sub_a_id',        subA ?? '')
      fd.set('sub_b_id',        subB ?? '')
      fd.set('bonus_player_id', bonusPlayer ?? '')
      fd.set('bonus_type',      activeBonusId ?? '')
      fd.set('bonus_data',      JSON.stringify(bonusData))

      const result = await savePick({ error: null }, fd)
      if (result?.error) setError(result.error)
    })
  }

  // ── Rendu ──

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* ══ Header ══ */}
      <header className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/60">
        <div className="max-w-lg mx-auto px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0">
              ← Retour
            </Link>
            <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
              <span className="text-xl leading-none">{getFlag(match.home_nation.name)}</span>
              <span className="text-sm font-bold text-zinc-100 truncate max-w-[80px]">{match.home_nation.name}</span>
              <span className="text-[10px] text-zinc-600 font-bold px-0.5">VS</span>
              <span className="text-sm font-bold text-zinc-100 truncate max-w-[80px]">{match.away_nation.name}</span>
              <span className="text-xl leading-none">{getFlag(match.away_nation.name)}</span>
            </div>
            <span className={`text-[10px] px-2 py-1 rounded-full font-semibold flex-shrink-0 ${isReadOnly ? 'bg-zinc-800 text-zinc-500' : 'bg-green-950 text-green-500'}`}>
              {isReadOnly ? 'Fermé' : 'Ouvert'}
            </span>
          </div>
          <p className="text-center text-[11px] text-zinc-500 capitalize">
            {format(new Date(match.kickoff_at), "EEEE d MMMM · HH'h'mm", { locale: fr })}
          </p>
          {!isReadOnly && (
            <p className="text-center text-[11px] text-zinc-600">
              Choisissez 2 joueurs par équipe · 1 joueur bonus ×1.5 · 1 bonus optionnel
            </p>
          )}
        </div>
      </header>

      <div className="max-w-lg mx-auto pb-28">

        {/* ══ Section Équipe A ══ */}
        <TeamSection
          nation={match.home_nation}
          players={playersA}
          selected={selA}
          sub={subA}
          usedIds={usedIds}
          isReadOnly={isReadOnly}
          onToggle={toggleSelA}
          onToggleSub={id => setSubA(prev => prev === id ? null : id)}
        />

        {/* ══ Section Équipe B ══ */}
        <TeamSection
          nation={match.away_nation}
          players={playersB}
          selected={selB}
          sub={subB}
          usedIds={usedIds}
          isReadOnly={isReadOnly}
          onToggle={toggleSelB}
          onToggleSub={id => setSubB(prev => prev === id ? null : id)}
        />

        {/* ══ Joueur bonus ×1.5 ══ */}
        {canSubmit && (
          <section className="px-4 py-5 border-b border-zinc-800/50">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-yellow-400 text-base leading-none">★</span>
              <h2 className="text-sm font-bold text-zinc-100">Joueur bonus ×1.5</h2>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Désignez 1 joueur dont la note sera multipliée par 1.5
            </p>
            <div className="grid grid-cols-2 gap-2">
              {allSelectedIds.map(id => {
                const p = allPlayers.find(x => x.id === id)
                if (!p) return null
                const isStar = bonusPlayer === id
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => setBonusPlayer(prev => prev === id ? null : id)}
                    className={[
                      'flex items-center gap-2.5 px-3 py-3 rounded-xl border transition-all text-left',
                      isStar
                        ? 'bg-yellow-950/50 border-yellow-600/70 ring-1 ring-yellow-600/20'
                        : 'bg-zinc-900/50 border-zinc-800/60 hover:border-zinc-600 cursor-pointer',
                    ].join(' ')}
                  >
                    <span className={`text-base leading-none ${isStar ? 'text-yellow-400' : 'text-zinc-700'}`}>★</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate leading-tight ${isStar ? 'text-yellow-200' : 'text-zinc-300'}`}>
                        {p.name}
                      </p>
                      <p className={`text-[9px] mt-0.5 ${POS_COLOR[p.position] ?? 'text-zinc-600'}`}>
                        {POS_LABEL[p.position]}
                        {isStar && <span className="ml-1 text-yellow-400 font-bold">×1.5</span>}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ══ Bonus de match ══ */}
        {!isReadOnly && userBonuses.length > 0 && (
          <section className="px-4 py-5 border-b border-zinc-800/50">
            <h2 className="text-sm font-bold text-zinc-100 mb-1">Votre bonus</h2>
            <p className="text-xs text-zinc-500 mb-4">
              1 seul activable par match — cliquez à nouveau pour désactiver
            </p>
            <div className="space-y-2">
              {userBonuses.map(ub => {
                const bType = ub.bonus?.id ?? ''
                const isActive = activeBonusId === ub.id
                return (
                  <div key={ub.id}>
                    {/* Toggle button */}
                    <button
                      type="button"
                      onClick={() => toggleActiveBonus(ub.id)}
                      className={[
                        'w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all text-left',
                        isActive
                          ? 'bg-violet-950/50 border-violet-600/70 ring-1 ring-violet-600/20'
                          : 'bg-zinc-900/50 border-zinc-800/60 hover:border-zinc-600',
                      ].join(' ')}
                    >
                      <span className="text-xl flex-shrink-0">{ub.bonus?.icon ?? '🎁'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${isActive ? 'text-violet-200' : 'text-zinc-200'}`}>
                            {ub.bonus?.name ?? 'Bonus'}
                          </span>
                          <span className="text-[10px] text-zinc-600">×{ub.remaining_uses} restant{ub.remaining_uses > 1 ? 's' : ''}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{ub.bonus?.description}</p>
                      </div>
                      {isActive && <span className="text-violet-400 text-[10px] font-bold flex-shrink-0">Activé ✓</span>}
                    </button>

                    {/* Détails contextuels */}
                    {isActive && (
                      <div className="mt-2 ml-3 pl-3.5 border-l-2 border-violet-800/40 py-1 space-y-2">

                        {/* Descriptions simples */}
                        {BONUS_DESC[bType] && bType !== 'troisieme_homme' && bType !== 'all_in' && (
                          <p className="text-xs text-violet-300 leading-relaxed">{BONUS_DESC[bType]}</p>
                        )}

                        {/* Troisième homme — sélecteur joueur */}
                        {bType === 'troisieme_homme' && (
                          <div className="space-y-1.5">
                            <p className="text-xs text-violet-300">
                              Choisissez un 3e joueur dans l&apos;équipe de votre choix :
                            </p>
                            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                              {allPlayers
                                .filter(p => !allSelectedIds.includes(p.id))
                                .map(p => {
                                  const isInA = playersA.some(x => x.id === p.id)
                                  const isChosen = troisHommePlayer === p.id
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => setTroisHommePlayer(prev => prev === p.id ? null : p.id)}
                                      className={[
                                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all',
                                        isChosen
                                          ? 'bg-violet-950/60 border-violet-600/50 text-violet-200'
                                          : 'bg-zinc-900/40 border-zinc-800/40 text-zinc-300 hover:border-zinc-600',
                                      ].join(' ')}
                                    >
                                      <span className="text-base leading-none">
                                        {getFlag(isInA ? match.home_nation.name : match.away_nation.name)}
                                      </span>
                                      <span className="flex-1 text-xs truncate font-medium">{p.name}</span>
                                      <span className={`text-[9px] font-bold ${POS_COLOR[p.position] ?? 'text-zinc-600'}`}>
                                        {POS_LABEL[p.position]}
                                      </span>
                                      {isChosen && <span className="text-violet-400 text-xs">✓</span>}
                                    </button>
                                  )
                                })
                              }
                            </div>
                          </div>
                        )}

                        {/* All-in — slider */}
                        {bType === 'all_in' && (
                          <div className="space-y-2 py-1">
                            <p className="text-xs text-violet-300">
                              Misez entre 1 et 10 pts de votre total :
                            </p>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min={1}
                                max={10}
                                step={1}
                                value={allInAmount}
                                onChange={e => setAllInAmount(Number(e.target.value))}
                                className="flex-1 accent-violet-500 h-2 cursor-pointer"
                              />
                              <span className="text-sm font-bold text-violet-300 w-12 text-right tabular-nums">
                                {allInAmount} pts
                              </span>
                            </div>
                            <div className="flex justify-between text-[9px] text-zinc-700 px-0.5">
                              <span>1 pt</span><span>10 pts</span>
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ══ Lecture seule ══ */}
        {isReadOnly && (
          <div className="px-4 py-6 text-center">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 inline-block">
              <p className="text-sm text-zinc-500">
                {match.status !== 'a_venir'
                  ? 'Ce match est terminé — picks en lecture seule'
                  : 'Le match a commencé — picks verrouillés'}
              </p>
            </div>
          </div>
        )}

      </div>

      {/* ══ Footer fixe — bouton ══ */}
      {!isReadOnly && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-zinc-950/95 backdrop-blur-sm border-t border-zinc-800/70 px-4 pt-3 pb-5">
          <div className="max-w-lg mx-auto space-y-2">
            {error && (
              <p className="text-red-400 text-xs text-center animate-pulse">{error}</p>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isPending}
              className={[
                'w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all duration-200',
                canSubmit && !isPending
                  ? 'bg-green-500 hover:bg-green-400 active:bg-green-600 text-white shadow-lg shadow-green-900/40'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed',
              ].join(' ')}
            >
              {isPending
                ? 'Enregistrement…'
                : canSubmit
                ? 'Valider mes picks ✓'
                : `Encore ${remaining} joueur${remaining > 1 ? 's' : ''} à sélectionner`
              }
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
