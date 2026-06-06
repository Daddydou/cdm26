import Link from 'next/link'

// ─── Data ─────────────────────────────────────────────────────────────────────

const BONUSES = [
  { icon: '⭐', name: 'Joueur ×2',          uses: '6 utilisations', desc: 'Un de vos joueurs voit sa note multipliée par 2 pour ce match.' },
  { icon: '⚡', name: 'Double Mise',         uses: '4 utilisations', desc: 'Vos points totaux du match sont multipliés par 2.' },
  { icon: '👤', name: 'Troisième Homme',     uses: '4 utilisations', desc: 'Ajoutez un 3e joueur à votre sélection. Sa note s\'additionne normalement.' },
  { icon: '🛡️', name: 'Bouclier',           uses: '2 utilisations', desc: 'Toutes les notes inférieures à 5 dans votre sélection sont remontées à 5.' },
  { icon: '🎯', name: 'Sniper',             uses: '3 utilisations', desc: '+3 points pour chaque buteur parmi vos joueurs sélectionnés.' },
  { icon: '🎪', name: 'Passeur de Génie',   uses: '3 utilisations', desc: '+3 points pour chaque passeur décisif parmi vos joueurs.' },
  { icon: '🧱', name: 'Mur',               uses: '2 utilisations', desc: '+5 points si votre gardien arrête un pénalty.' },
  { icon: '🕵️', name: 'Espion',            uses: '2 utilisations', desc: 'Vous voyez les picks des autres participants avant le coup d\'envoi.' },
  { icon: '🎲', name: 'All-In',            uses: '2 utilisations', desc: 'Misez entre 1 et 10 points sur votre performance — vous les gagnez ou les perdez selon que vous faites mieux ou moins bien que la moyenne.' },
]

const PHASES = [
  { label: 'Phase de groupes',  mult: '×1',   color: 'text-zinc-400' },
  { label: '8es de finale',     mult: '×1.2', color: 'text-sky-400' },
  { label: 'Quarts de finale',  mult: '×1.4', color: 'text-blue-400' },
  { label: 'Demi-finales',      mult: '×1.6', color: 'text-violet-400' },
  { label: 'Finale',            mult: '×2',   color: 'text-amber-400' },
]

const NATIONS = [
  'Argentine', 'Allemagne', 'Angleterre', 'Belgique',
  'Brésil', 'Croatie', 'Espagne', 'États-Unis',
  'France', 'Maroc', 'Mexique', 'Pays-Bas',
  'Portugal', 'Suède',
]

function isoFlag(code: string) {
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  )
}

const NATION_FLAGS: Record<string, string> = {
  'Argentine':  isoFlag('AR'), 'Allemagne':  isoFlag('DE'),
  'Angleterre': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',       'Belgique':   isoFlag('BE'),
  'Brésil':     isoFlag('BR'), 'Croatie':    isoFlag('HR'),
  'Espagne':    isoFlag('ES'), 'États-Unis': isoFlag('US'),
  'France':     isoFlag('FR'), 'Maroc':      isoFlag('MA'),
  'Mexique':    isoFlag('MX'), 'Pays-Bas':   isoFlag('NL'),
  'Portugal':   isoFlag('PT'), 'Suède':      isoFlag('SE'),
}

// ─── Components ───────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-base font-bold text-zinc-100 whitespace-nowrap">{children}</h2>
      <div className="flex-1 h-px bg-zinc-800" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* ── Header ── */}
      <header className="bg-zinc-950 border-b border-zinc-800/60 px-4 py-5">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-xl font-black tracking-tight">
              CDM<span style={{ color: '#1D9E75' }}>26</span>
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Guide du participant</p>
          </div>
          <Link
            href="/connexion"
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
          >
            Se connecter
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-10 pb-16">

        {/* ── Section 1 — Inscription ── */}
        <section>
          <SectionTitle>1 · Inscription</SectionTitle>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <p className="text-sm text-zinc-300 leading-relaxed">
              Crée ton compte sur CDM26, puis rejoins le groupe avec le code ci-dessous.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/inscription"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-colors"
                style={{ backgroundColor: '#1D9E75' }}
              >
                Créer mon compte →
              </Link>
              <div className="flex items-center justify-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3">
                <span className="text-xs text-zinc-500 font-medium">Code groupe</span>
                <span className="font-mono font-bold text-zinc-100 tracking-widest">CDM2026</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 2 — Comment jouer ── */}
        <section>
          <SectionTitle>2 · Comment jouer</SectionTitle>
          <div className="space-y-3">
            {[
              { step: '1', title: 'Choisis tes joueurs', desc: 'Pour chaque match, sélectionne 2 joueurs dans chaque équipe (4 au total). Tu peux choisir parmi les 14 nations disponibles.' },
              { step: '2', title: 'Désigne ton joueur ×2', desc: 'Parmi tes 4 joueurs, désigne-en un dont la note sera doublée. Tu as 6 utilisations sur tout le tournoi.' },
              { step: '3', title: 'Active un bonus', desc: 'Chaque participant dispose d\'un stock de bonus à utiliser à sa guise au fil des matchs (optionnel).' },
              { step: '4', title: 'Tes points', desc: 'Après le match, les notes SofaScore de tes joueurs s\'additionnent. Le multiplicateur de phase s\'applique au total.' },
              { step: '5', title: 'Contrainte joueur unique', desc: 'Un joueur utilisé dans un pick ne peut pas être repris dans un autre match — sauf s\'il n\'a pas joué.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: '#1D9E75' }}
                >
                  {step}
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-100 leading-tight">{title}</p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 3 — Multiplicateurs ── */}
        <section>
          <SectionTitle>3 · Multiplicateurs de phase</SectionTitle>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {PHASES.map(({ label, mult, color }, i) => (
              <div
                key={label}
                className={`flex items-center justify-between px-4 py-3 ${i < PHASES.length - 1 ? 'border-b border-zinc-800/60' : ''}`}
              >
                <span className="text-sm text-zinc-300">{label}</span>
                <span className={`text-sm font-bold tabular-nums ${color}`}>{mult}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-zinc-600 mt-2 px-1">
            Les points finaux = (somme des notes) × multiplicateur de phase
          </p>
        </section>

        {/* ── Section 4 — Bonus ── */}
        <section>
          <SectionTitle>4 · Les bonus</SectionTitle>
          <div className="space-y-2">
            {BONUSES.map(({ icon, name, uses, desc }) => (
              <div key={name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-3">
                <span className="text-2xl leading-none flex-shrink-0 mt-0.5">{icon}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-zinc-100 leading-tight">{name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-500 font-medium">
                      {uses}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 5 — Nations ── */}
        <section>
          <SectionTitle>5 · Nations disponibles</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {NATIONS.map(name => (
              <div key={name} className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5">
                <span className="text-xl leading-none flex-shrink-0">{NATION_FLAGS[name] ?? '⚽'}</span>
                <span className="text-sm font-medium text-zinc-200 truncate">{name}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-zinc-600 mt-2 px-1">
            14 nations · 2 joueurs par équipe à choisir pour chaque match
          </p>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-zinc-800 pt-6 text-center">
          <p className="text-sm text-zinc-500">
            Des questions ?{' '}
            <span className="text-zinc-300 font-medium">Contacte Daddy</span>
          </p>
          <p className="text-[11px] text-zinc-700 mt-2">CDM26 · Coupe du Monde 2026</p>
        </footer>

      </main>
    </div>
  )
}
