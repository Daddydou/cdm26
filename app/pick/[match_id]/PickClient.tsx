'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { savePick } from '@/app/actions/picks'
import { formatInTimeZone } from 'date-fns-tz'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import Image from 'next/image'

// ─── Types ────────────────────────────────────────────────────────────────────

type Player = {
  id: string
  name: string
  position: string
  photo_url: string | null
  shirt_number?: number | null
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
  player_a1_id?: string | null
  player_a2_id?: string | null
  player_b1_id?: string | null
  player_b2_id?: string | null
  bonus_player_id?: string | null
  bonus_type?: string | null
}

type BonusRecord = {
  id: string
  bonus_type: string
  remaining_uses: number
}

type EspionPick = {
  id: string
  bonus_type: string | null
  bonus_player_id: string | null
  player_a1: { name: string; position: string } | null
  player_a2: { name: string; position: string } | null
  player_b1: { name: string; position: string } | null
  player_b2: { name: string; position: string } | null
  user: { username: string; photo_url: string | null } | null
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
const _POS_TITLE: Record<string, string> = { GK: 'Gardiens', DEF: 'Défenseurs', MID: 'Milieux', FWD: 'Attaquants' }

// ─── Métadonnées bonus ────────────────────────────────────────────────────────

const BONUS_META: Record<string, { icon: string; name: string; desc: string }> = {
  double_mise:     { icon: '⚡', name: 'Double Mise',      desc: 'Vos points totaux ce match seront ×2' },
  troisieme_homme: { icon: '👤', name: 'Troisième Homme',  desc: 'Ajoutez un 3e joueur à votre sélection. Sa note compte normalement.' },
  bouclier:        { icon: '🛡️', name: 'Bouclier',         desc: 'Les notes inférieures à 5 seront remontées à 5' },
  sniper:          { icon: '🎯', name: 'Sniper',           desc: 'Si un de vos joueurs marque, +3 pts' },
  passeur_genie:   { icon: '🎪', name: 'Passeur de Génie', desc: 'Si un de vos joueurs fait une passe décisive, +3 pts' },
  mur:             { icon: '🧱', name: 'Mur',              desc: "Si votre gardien arrête un pénalty, +5 pts" },
  capitaine_bis:   { icon: '👑', name: 'Capitaine Bis',    desc: 'Votre joueur bonus sera ×2 au lieu de ×1.5' },
  espion:          { icon: '🕵️', name: 'Espion',           desc: 'Vous verrez les picks des autres participants avant le début du match' },
  all_in:          { icon: '🎲', name: 'All-In',           desc: 'Misez entre 1 et 10 pts de votre total sur ce match' },
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
  const [showTooltip, setShowTooltip] = useState(false)
  const initials = player.name.split(' ').map(n => n[0]).slice(0, 2).join('')
  return (
    <div className="relative">
      {showTooltip && !isDisabled && (
        <div style={{
          position: 'absolute', right: '100%', top: 0,
          background: '#18181b', border: '1px solid #3f3f46',
          borderRadius: '8px', padding: '8px 12px',
          fontSize: '12px', color: 'white', zIndex: 50,
          minWidth: '160px', maxWidth: '200px',
          pointerEvents: 'none', marginRight: '6px',
          whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 600 }}>{player.name}</div>
          <div style={{ color: '#a1a1aa', fontSize: '11px', marginTop: '2px' }}>
            {player.shirt_number != null ? `#${player.shirt_number} · ` : ''}
            {player.position}
          </div>
        </div>
      )}
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
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
    </div>
  )
}

// ─── TeamSection ──────────────────────────────────────────────────────────────

function TeamSection({
  nation, players, selected, usedIds, isReadOnly, onToggle,
}: {
  nation: NationInfo
  players: Player[]
  selected: string[]
  usedIds: Set<string>
  isReadOnly: boolean
  onToggle: (id: string) => void
}) {
  return (
    <section className="px-4 py-5 border-b border-zinc-800/50">
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

      <div className="space-y-1.5">
        {players.map(player => (
          <PlayerCard
            key={player.id}
            player={player}
            isSelected={selected.includes(player.id)}
            isDisabled={!isReadOnly && usedIds.has(player.id) && !selected.includes(player.id)}
            onClick={() => onToggle(player.id)}
          />
        ))}
      </div>
    </section>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PickClient({
  match, playersA, playersB, existingPick, usedPlayerIds, userBonuses, isReadOnly, x15Used, espionPicks,
}: {
  match: MatchData
  playersA: Player[]
  playersB: Player[]
  existingPick: ExistingPick | null
  usedPlayerIds: string[]
  userBonuses: BonusRecord[]
  isReadOnly: boolean
  x15Used: number
  espionPicks?: EspionPick[] | null
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast]   = useState<string | null>(null)
  const router = useRouter()

  // Sélections principales
  const [selA, setSelA] = useState<string[]>(() =>
    [existingPick?.player_a1_id, existingPick?.player_a2_id].filter(Boolean) as string[]
  )
  const [selB, setSelB] = useState<string[]>(() =>
    [existingPick?.player_b1_id, existingPick?.player_b2_id].filter(Boolean) as string[]
  )
  // Joueur bonus ×1.5
  const [bonusPlayer, setBonusPlayer] = useState<string | null>(existingPick?.bonus_player_id ?? null)

  // Bonus de match
  const [activeBonusId, setActiveBonusId] = useState<string | null>(existingPick?.bonus_type ?? null)
  const [troisHommePlayer, setTroisHommePlayer] = useState<string | null>(null)
  const [troisHommeTeam, setTroisHommeTeam] = useState<'A' | 'B' | null>(null)
  const [allInAmount, setAllInAmount] = useState(5)

  // Dérivés
  const usedIds = new Set(usedPlayerIds)
  const canSubmit = selA.length === 2 && selB.length === 2
  const allSelectedIds = [...selA, ...selB]
  const allPlayers = [...playersA, ...playersB]
  const remaining = (2 - selA.length) + (2 - selB.length)

  // 'star' = option permanente ×1.5, sinon UUID cdm_user_bonuses
  const activeBonus = (activeBonusId && activeBonusId !== 'star')
    ? (userBonuses ?? []).find(ub => ub.id === activeBonusId) ?? null
    : null
  const activeBonusType = activeBonus?.bonus_type ?? null

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

  function handleBonusChange(val: string) {
    setTroisHommePlayer(null)
    setTroisHommeTeam(null)
    const selectedBonusType = (userBonuses ?? []).find(ub => ub.id === val)?.bonus_type
    // Conserve le joueur ×1.5 quand on bascule entre 'star' et 'capitaine_bis'
    if (val !== 'star' && selectedBonusType !== 'capitaine_bis') setBonusPlayer(null)
    setActiveBonusId(val || null)
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
      fd.set('bonus_player_id', bonusPlayer ?? '')
      // bonus_type = valeur texte du bonus (ex: 'mur'), user_bonus_id = UUID pour le décrement
      const activeBonusRecord = (userBonuses ?? []).find(ub => ub.id === activeBonusId)
      fd.set('bonus_type',    activeBonusRecord?.bonus_type ?? '')
      fd.set('user_bonus_id', (activeBonusId && activeBonusId !== 'star') ? activeBonusId : '')
      fd.set('bonus_data',      JSON.stringify(bonusData))

      const result = await savePick({ error: null }, fd)
      if (result?.error) {
        setError(result.error)
      } else {
        setToast('Picks enregistrés ! Bonne chance 🎉')
        setTimeout(() => router.push('/'), 2000)
      }
    })
  }

  // ── Rendu ──

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* ══ Toast succès ══ */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-lg shadow-green-900/40 animate-pulse">
          ✓ {toast}
        </div>
      )}

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
            {formatInTimeZone(new Date(match.kickoff_at), 'Europe/Paris', "EEE d MMM · HH'h'mm", { locale: fr })}
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
          usedIds={usedIds}
          isReadOnly={isReadOnly}
          onToggle={toggleSelA}
        />

        {/* ══ Section Équipe B ══ */}
        <TeamSection
          nation={match.away_nation}
          players={playersB}
          selected={selB}
          usedIds={usedIds}
          isReadOnly={isReadOnly}
          onToggle={toggleSelB}
        />

        {/* ══ Bonus & Joueur ×1.5 (section unifiée) ══ */}
        {!isReadOnly && (
          <section className="px-4 py-5 border-b border-zinc-800/50">
            <h2 className="text-sm font-bold text-zinc-100 mb-1">Bonus & Joueur ×1.5</h2>
            <p className="text-xs text-zinc-500 mb-3">1 option par match — optionnel</p>

            {/* ── Dropdown ── */}
            <div className="relative">
              <select
                value={activeBonusId ?? ''}
                onChange={e => handleBonusChange(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-xl px-3.5 py-3 text-sm appearance-none focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 transition-colors cursor-pointer pr-8"
              >
                <option value="">Aucun bonus</option>
                {(10 - x15Used) > 0 && (
                  <option value="star">⭐ Joueur ×1.5 ({10 - x15Used}/10 restants)</option>
                )}
                {(userBonuses ?? []).map(ub => {
                  const meta = BONUS_META[ub.bonus_type]
                  const max  = ub.bonus_type === 'double_mise' || ub.bonus_type === 'troisieme_homme' ? 4
                             : ub.bonus_type === 'sniper'      || ub.bonus_type === 'passeur_genie'  ? 3 : 2
                  return (
                    <option key={ub.id} value={ub.id}>
                      {meta ? `${meta.icon} ${meta.name}` : ub.bonus_type}
                      {' '}({ub.remaining_uses}/{max} restants)
                    </option>
                  )
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center">
                <span className="text-zinc-500 text-xs">▾</span>
              </div>
            </div>

            {/* ── ⭐ Joueur ×1.5 / 👑 Capitaine Bis — sélection parmi les 4 joueurs ── */}
            {(activeBonusId === 'star' || activeBonusType === 'capitaine_bis') && (
              <div className="mt-3 bg-yellow-950/20 border border-yellow-800/30 rounded-xl p-4 space-y-3">
                <p className="text-xs text-yellow-300 font-medium">
                  Désignez le joueur dont la note sera {activeBonusType === 'capitaine_bis' ? '×2' : '×1.5'} :
                </p>
                {canSubmit ? (
                  <div className="grid grid-cols-2 gap-2">
                    {allSelectedIds.map(id => {
                      const p = allPlayers.find(x => x.id === id)
                      if (!p) return null
                      const isStar = bonusPlayer === id
                      return (
                        <button
                          key={id}
                          type="button"
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
                            <p className={`text-xs font-semibold truncate leading-tight ${isStar ? 'text-yellow-200' : 'text-zinc-300'}`}>{p.name}</p>
                            <p className={`text-[9px] mt-0.5 ${POS_COLOR[p.position] ?? 'text-zinc-600'}`}>
                              {POS_LABEL[p.position]}{isStar && <span className="ml-1 text-yellow-400 font-bold">{activeBonusType === 'capitaine_bis' ? '×2' : '×1.5'}</span>}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600 italic">
                    Sélectionnez vos 4 joueurs d&apos;abord pour désigner le joueur ×1.5
                  </p>
                )}
              </div>
            )}

            {/* ── Carte bonus réel (cdm_user_bonuses) ── */}
            {activeBonus && (
              <div className="mt-3 bg-violet-950/30 border border-violet-800/40 rounded-xl p-4 space-y-4">
                {/* En-tête */}
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none flex-shrink-0">
                    {BONUS_META[activeBonusType ?? '']?.icon ?? '🎁'}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-violet-200">
                      {BONUS_META[activeBonusType ?? '']?.name ?? activeBonusType}
                    </p>
                    <p className="text-xs text-violet-300/80 mt-1 leading-relaxed">
                      {BONUS_META[activeBonusType ?? '']?.desc}
                    </p>
                  </div>
                </div>

                {/* Troisième homme — sélecteur équipe puis joueur */}
                {activeBonusType === 'troisieme_homme' && (
                  <div className="space-y-2">
                    <p className="text-xs text-violet-300 font-medium">Choisissez l&apos;équipe :</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['A', 'B'] as const).map(team => {
                        const nation = team === 'A' ? match.home_nation : match.away_nation
                        return (
                          <button
                            key={team}
                            type="button"
                            onClick={() => { setTroisHommeTeam(team); setTroisHommePlayer(null) }}
                            className={[
                              'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all text-xs font-medium',
                              troisHommeTeam === team
                                ? 'bg-violet-950/60 border-violet-600/50 text-violet-200'
                                : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-300 hover:border-zinc-600',
                            ].join(' ')}
                          >
                            <span className="text-base leading-none">{getFlag(nation.name)}</span>
                            <span className="truncate">{nation.name}</span>
                          </button>
                        )
                      })}
                    </div>
                    {troisHommeTeam && (
                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                        {(troisHommeTeam === 'A' ? playersA : playersB)
                          .filter(p => !(troisHommeTeam === 'A' ? selA : selB).includes(p.id))
                          .map(p => {
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
                                    : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-300 hover:border-zinc-600',
                                ].join(' ')}
                              >
                                <span className="flex-1 text-xs font-medium truncate">{p.name}</span>
                                <span className={`text-[9px] font-bold flex-shrink-0 ${POS_COLOR[p.position] ?? 'text-zinc-600'}`}>
                                  {POS_LABEL[p.position]}
                                </span>
                                {isChosen && <span className="text-violet-400 text-xs ml-1">✓</span>}
                              </button>
                            )
                          })
                        }
                      </div>
                    )}
                  </div>
                )}

                {/* All-in — input numérique */}
                {activeBonusType === 'all_in' && (
                  <div className="space-y-2">
                    <label className="text-xs text-violet-300 font-medium">Mise (pts) :</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={allInAmount}
                        onChange={e => setAllInAmount(Math.min(10, Math.max(1, Number(e.target.value))))}
                        className="w-20 bg-zinc-800 border border-zinc-700 text-violet-200 rounded-lg px-3 py-2 text-sm font-bold text-center focus:outline-none focus:border-violet-500 tabular-nums"
                      />
                      <span className="text-xs text-zinc-500">entre 1 et 10 pts</span>
                    </div>
                  </div>
                )}

                {/* Espion — message informatif */}
                {activeBonusType === 'espion' && (
                  <p className="text-xs text-violet-300 bg-violet-950/40 rounded-lg px-3 py-2.5 leading-relaxed">
                    🕵️ Vous verrez les picks des autres participants avant le début du match
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {/* ══ Espion — picks des autres participants ══ */}
        {espionPicks && espionPicks.length > 0 && !isReadOnly && (
          <section className="px-4 py-5 border-b border-zinc-800/50">
            <h2 className="text-sm font-bold text-zinc-100 mb-1 flex items-center gap-2">
              🕵️ Picks adverses
              <span className="text-xs font-normal text-zinc-500">(bonus Espion actif)</span>
            </h2>
            <div className="space-y-3 mt-3">
              {espionPicks.map(pick => {
                const u = pick.user
                const players = [pick.player_a1, pick.player_a2, pick.player_b1, pick.player_b2]
                  .filter(Boolean) as { name: string; position: string }[]
                return (
                  <div key={pick.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-zinc-800 flex-shrink-0 flex items-center justify-center text-[10px] font-semibold text-zinc-500 overflow-hidden">
                        {u?.photo_url
                          ? <Image src={u.photo_url} alt={u.username} width={24} height={24} className="object-cover w-full h-full" />
                          : u?.username?.[0]?.toUpperCase() ?? '?'
                        }
                      </div>
                      <span className="text-xs font-semibold text-zinc-300">{u?.username ?? 'Inconnu'}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {players.map((p, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-zinc-800/60 border border-zinc-700/40 text-zinc-400">
                          <span className={`text-[10px] font-bold ${POS_COLOR[p.position] ?? 'text-zinc-600'}`}>
                            {POS_LABEL[p.position] ?? p.position}
                          </span>
                          {p.name}
                        </span>
                      ))}
                    </div>
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
