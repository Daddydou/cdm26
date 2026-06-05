/**
 * Script d'import CdM 2026
 * Données issues du tirage officiel FIFA du 5 décembre 2025.
 * FotMob API non disponible pour 2026 — données statiques.
 *
 * Groupes réels :
 * A: Mexique, Afrique du Sud, Corée du Sud, République Tchèque
 * B: Canada, Bosnie-Herzégovine, Qatar, Suisse
 * C: Brésil, Maroc, Haïti, Écosse
 * D: États-Unis, Paraguay, Australie, Turquie
 * E: Allemagne, Curaçao, Côte d'Ivoire, Équateur
 * F: Pays-Bas, Japon, Suède, Tunisie
 * G: Belgique, Égypte, Iran, Nouvelle-Zélande
 * H: Espagne, Cap-Vert, Arabie Saoudite, Uruguay
 * I: France, Sénégal, Irak, Norvège
 * J: Argentine, Algérie, Autriche, Jordanie
 * K: Portugal, RD Congo, Ouzbékistan, Colombie
 * L: Angleterre, Croatie, Ghana, Panama
 *
 * Horaires UTC approximatifs (heures locales converties).
 * Phases eliminatoires avec nation "À Déterminer" à mettre à jour au fil du tournoi.
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ─── Nations ──────────────────────────────────────────────────────────────────

const NATIONS_DATA = [
  // Groupe A
  { name: 'Mexique',              code: 'MX'   },
  { name: 'Afrique du Sud',       code: 'ZA'   },
  { name: 'Corée du Sud',         code: 'KR'   },
  { name: 'République Tchèque',   code: 'CZ'   },
  // Groupe B
  { name: 'Canada',               code: 'CA'   },
  { name: 'Bosnie-Herzégovine',   code: 'BA'   },
  { name: 'Qatar',                code: 'QA'   },
  { name: 'Suisse',               code: 'CH'   },
  // Groupe C
  { name: 'Brésil',              code: 'BR'   },
  { name: 'Maroc',                code: 'MA'   },
  { name: 'Haïti',               code: 'HT'   },
  { name: 'Écosse',              code: 'XSCT' },
  // Groupe D
  { name: 'États-Unis',           code: 'US'   },
  { name: 'Paraguay',             code: 'PY'   },
  { name: 'Australie',            code: 'AU'   },
  { name: 'Turquie',              code: 'TR'   },
  // Groupe E
  { name: 'Allemagne',            code: 'DE'   },
  { name: 'Curaçao',             code: 'CW'   },
  { name: "Côte d'Ivoire",       code: 'CI'   },
  { name: 'Équateur',            code: 'EC'   },
  // Groupe F
  { name: 'Pays-Bas',             code: 'NL'   },
  { name: 'Japon',                code: 'JP'   },
  { name: 'Suède',               code: 'SE'   },
  { name: 'Tunisie',              code: 'TN'   },
  // Groupe G
  { name: 'Belgique',             code: 'BE'   },
  { name: 'Égypte',              code: 'EG'   },
  { name: 'Iran',                 code: 'IR'   },
  { name: 'Nouvelle-Zélande',    code: 'NZ'   },
  // Groupe H
  { name: 'Espagne',              code: 'ES'   },
  { name: 'Cap-Vert',             code: 'CV'   },
  { name: 'Arabie Saoudite',      code: 'SA'   },
  { name: 'Uruguay',              code: 'UY'   },
  // Groupe I
  { name: 'France',               code: 'FR'   },
  { name: 'Sénégal',             code: 'SN'   },
  { name: 'Irak',                 code: 'IQ'   },
  { name: 'Norvège',             code: 'NO'   },
  // Groupe J
  { name: 'Argentine',            code: 'AR'   },
  { name: 'Algérie',             code: 'DZ'   },
  { name: 'Autriche',             code: 'AT'   },
  { name: 'Jordanie',             code: 'JO'   },
  // Groupe K
  { name: 'Portugal',             code: 'PT'   },
  { name: 'RD Congo',             code: 'CD'   },
  { name: 'Ouzbékistan',         code: 'UZ'   },
  { name: 'Colombie',             code: 'CO'   },
  // Groupe L
  { name: 'Angleterre',           code: 'XENG' },
  { name: 'Croatie',              code: 'HR'   },
  { name: 'Ghana',                code: 'GH'   },
  { name: 'Panama',               code: 'PA'   },
  // Placeholder phases éliminatoires
  { name: 'À Déterminer',         code: 'TBD'  },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchDef = {
  a: string
  b: string
  kickoff: string
  phase: string
  multiplier?: number
}

// ─── Phase de groupes (72 matchs) ─────────────────────────────────────────────

const GROUP_MATCHES: MatchDef[] = [
  // ── Groupe A ─────────────────────────────────────────────────────────────────
  // Mexique ouvre le tournoi à Mexico, 11 juin 13h CDT (UTC-6) = 19h UTC
  { a: 'Mexique',            b: 'Afrique du Sud',      kickoff: '2026-06-11T19:00:00Z', phase: 'groupes' },
  // Corée du Sud vs Rép. Tchèque, Zapopan, 20h CDT = 02h UTC
  { a: 'Corée du Sud',       b: 'République Tchèque',  kickoff: '2026-06-12T02:00:00Z', phase: 'groupes' },
  { a: 'République Tchèque', b: 'Afrique du Sud',       kickoff: '2026-06-18T16:00:00Z', phase: 'groupes' },
  { a: 'Mexique',            b: 'Corée du Sud',          kickoff: '2026-06-19T01:00:00Z', phase: 'groupes' },
  { a: 'République Tchèque', b: 'Mexique',              kickoff: '2026-06-25T01:00:00Z', phase: 'groupes' },
  { a: 'Afrique du Sud',     b: 'Corée du Sud',          kickoff: '2026-06-25T01:00:00Z', phase: 'groupes' },

  // ── Groupe B ─────────────────────────────────────────────────────────────────
  // Canada ouvre à Toronto, 12 juin 15h EDT (UTC-4) = 19h UTC
  { a: 'Canada',             b: 'Bosnie-Herzégovine',   kickoff: '2026-06-12T19:00:00Z', phase: 'groupes' },
  { a: 'Qatar',              b: 'Suisse',               kickoff: '2026-06-13T19:00:00Z', phase: 'groupes' },
  { a: 'Suisse',             b: 'Bosnie-Herzégovine',   kickoff: '2026-06-18T19:00:00Z', phase: 'groupes' },
  { a: 'Canada',             b: 'Qatar',                kickoff: '2026-06-18T22:00:00Z', phase: 'groupes' },
  { a: 'Suisse',             b: 'Canada',               kickoff: '2026-06-24T19:00:00Z', phase: 'groupes' },
  { a: 'Bosnie-Herzégovine', b: 'Qatar',                kickoff: '2026-06-24T22:00:00Z', phase: 'groupes' },

  // ── Groupe C ─────────────────────────────────────────────────────────────────
  { a: 'Brésil',            b: 'Maroc',                kickoff: '2026-06-13T22:00:00Z', phase: 'groupes' },
  { a: 'Haïti',             b: 'Écosse',              kickoff: '2026-06-14T01:00:00Z', phase: 'groupes' },
  { a: 'Écosse',            b: 'Maroc',                kickoff: '2026-06-19T22:00:00Z', phase: 'groupes' },
  { a: 'Brésil',            b: 'Haïti',               kickoff: '2026-06-20T00:00:00Z', phase: 'groupes' },
  { a: 'Écosse',            b: 'Brésil',              kickoff: '2026-06-24T22:00:00Z', phase: 'groupes' },
  { a: 'Maroc',              b: 'Haïti',               kickoff: '2026-06-24T22:00:00Z', phase: 'groupes' },

  // ── Groupe D ─────────────────────────────────────────────────────────────────
  // USA à Inglewood, 12 juin 18h PDT (UTC-7) = 01h UTC le 13
  { a: 'États-Unis',         b: 'Paraguay',             kickoff: '2026-06-13T01:00:00Z', phase: 'groupes' },
  { a: 'Australie',          b: 'Turquie',              kickoff: '2026-06-13T04:00:00Z', phase: 'groupes' },
  { a: 'États-Unis',         b: 'Australie',            kickoff: '2026-06-19T19:00:00Z', phase: 'groupes' },
  { a: 'Turquie',            b: 'Paraguay',             kickoff: '2026-06-20T03:00:00Z', phase: 'groupes' },
  { a: 'Turquie',            b: 'États-Unis',           kickoff: '2026-06-26T02:00:00Z', phase: 'groupes' },
  { a: 'Paraguay',           b: 'Australie',            kickoff: '2026-06-26T02:00:00Z', phase: 'groupes' },

  // ── Groupe E ─────────────────────────────────────────────────────────────────
  { a: 'Allemagne',          b: 'Curaçao',             kickoff: '2026-06-14T19:00:00Z', phase: 'groupes' },
  { a: "Côte d'Ivoire",     b: 'Équateur',            kickoff: '2026-06-14T23:00:00Z', phase: 'groupes' },
  { a: 'Allemagne',          b: "Côte d'Ivoire",       kickoff: '2026-06-20T18:00:00Z', phase: 'groupes' },
  { a: 'Équateur',          b: 'Curaçao',             kickoff: '2026-06-21T00:00:00Z', phase: 'groupes' },
  { a: 'Curaçao',           b: "Côte d'Ivoire",       kickoff: '2026-06-26T00:00:00Z', phase: 'groupes' },
  { a: 'Équateur',          b: 'Allemagne',            kickoff: '2026-06-26T01:00:00Z', phase: 'groupes' },

  // ── Groupe F ─────────────────────────────────────────────────────────────────
  // Pays-Bas vs Japon, Arlington, 14 juin 15h CDT (UTC-5) = 20h UTC
  { a: 'Pays-Bas',           b: 'Japon',                kickoff: '2026-06-14T20:00:00Z', phase: 'groupes' },
  // Suède vs Tunisie, Guadalupe, 14 juin 20h CDT (UTC-6) = 02h UTC
  { a: 'Suède',             b: 'Tunisie',              kickoff: '2026-06-15T02:00:00Z', phase: 'groupes' },
  { a: 'Pays-Bas',           b: 'Suède',               kickoff: '2026-06-20T17:00:00Z', phase: 'groupes' },
  { a: 'Tunisie',            b: 'Japon',                kickoff: '2026-06-21T04:00:00Z', phase: 'groupes' },
  { a: 'Japon',              b: 'Suède',               kickoff: '2026-06-25T23:00:00Z', phase: 'groupes' },
  { a: 'Tunisie',            b: 'Pays-Bas',             kickoff: '2026-06-25T23:00:00Z', phase: 'groupes' },

  // ── Groupe G ─────────────────────────────────────────────────────────────────
  // Belgique vs Égypte, Seattle, 15 juin 12h PDT (UTC-7) = 19h UTC
  { a: 'Belgique',           b: 'Égypte',             kickoff: '2026-06-15T19:00:00Z', phase: 'groupes' },
  { a: 'Iran',               b: 'Nouvelle-Zélande',    kickoff: '2026-06-16T01:00:00Z', phase: 'groupes' },
  { a: 'Belgique',           b: 'Iran',               kickoff: '2026-06-21T19:00:00Z', phase: 'groupes' },
  { a: 'Nouvelle-Zélande',  b: 'Égypte',             kickoff: '2026-06-22T01:00:00Z', phase: 'groupes' },
  { a: 'Égypte',            b: 'Iran',               kickoff: '2026-06-27T03:00:00Z', phase: 'groupes' },
  { a: 'Nouvelle-Zélande',  b: 'Belgique',           kickoff: '2026-06-27T03:00:00Z', phase: 'groupes' },

  // ── Groupe H ─────────────────────────────────────────────────────────────────
  // Espagne vs Cap-Vert, Atlanta, 15 juin 12h EDT (UTC-4) = 16h UTC
  { a: 'Espagne',            b: 'Cap-Vert',            kickoff: '2026-06-15T16:00:00Z', phase: 'groupes' },
  { a: 'Arabie Saoudite',    b: 'Uruguay',             kickoff: '2026-06-15T22:00:00Z', phase: 'groupes' },
  { a: 'Espagne',            b: 'Arabie Saoudite',     kickoff: '2026-06-21T16:00:00Z', phase: 'groupes' },
  { a: 'Uruguay',            b: 'Cap-Vert',            kickoff: '2026-06-21T22:00:00Z', phase: 'groupes' },
  // 26 juin 19h CDT = 00h UTC le 27
  { a: 'Cap-Vert',           b: 'Arabie Saoudite',     kickoff: '2026-06-27T00:00:00Z', phase: 'groupes' },
  { a: 'Uruguay',            b: 'Espagne',             kickoff: '2026-06-27T00:00:00Z', phase: 'groupes' },

  // ── Groupe I ─────────────────────────────────────────────────────────────────
  // France vs Sénégal, 16 juin 15h EDT (UTC-4) = 19h UTC
  { a: 'France',             b: 'Sénégal',            kickoff: '2026-06-16T19:00:00Z', phase: 'groupes' },
  { a: 'Irak',               b: 'Norvège',            kickoff: '2026-06-16T22:00:00Z', phase: 'groupes' },
  { a: 'France',             b: 'Irak',               kickoff: '2026-06-22T21:00:00Z', phase: 'groupes' },
  { a: 'Norvège',           b: 'Sénégal',            kickoff: '2026-06-23T00:00:00Z', phase: 'groupes' },
  { a: 'Norvège',           b: 'France',             kickoff: '2026-06-26T19:00:00Z', phase: 'groupes' },
  { a: 'Sénégal',           b: 'Irak',               kickoff: '2026-06-26T19:00:00Z', phase: 'groupes' },

  // ── Groupe J ─────────────────────────────────────────────────────────────────
  // Argentine vs Algérie, Kansas City, 16 juin 20h EDT (UTC-4) = 00h UTC le 17
  { a: 'Argentine',          b: 'Algérie',            kickoff: '2026-06-17T00:00:00Z', phase: 'groupes' },
  // Autriche vs Jordanie, Santa Clara, 16 juin 21h PDT (UTC-7) = 04h UTC le 17
  { a: 'Autriche',           b: 'Jordanie',           kickoff: '2026-06-17T04:00:00Z', phase: 'groupes' },
  { a: 'Argentine',          b: 'Autriche',           kickoff: '2026-06-22T16:00:00Z', phase: 'groupes' },
  { a: 'Jordanie',           b: 'Algérie',            kickoff: '2026-06-23T03:00:00Z', phase: 'groupes' },
  // 27 juin 21h EDT = 01h UTC le 28
  { a: 'Algérie',           b: 'Autriche',           kickoff: '2026-06-28T01:00:00Z', phase: 'groupes' },
  { a: 'Jordanie',           b: 'Argentine',          kickoff: '2026-06-28T01:00:00Z', phase: 'groupes' },

  // ── Groupe K ─────────────────────────────────────────────────────────────────
  { a: 'Portugal',           b: 'RD Congo',           kickoff: '2026-06-17T18:00:00Z', phase: 'groupes' },
  { a: 'Ouzbékistan',       b: 'Colombie',           kickoff: '2026-06-17T21:00:00Z', phase: 'groupes' },
  { a: 'Portugal',           b: 'Ouzbékistan',        kickoff: '2026-06-23T18:00:00Z', phase: 'groupes' },
  { a: 'Colombie',           b: 'RD Congo',           kickoff: '2026-06-23T21:00:00Z', phase: 'groupes' },
  { a: 'Colombie',           b: 'Portugal',           kickoff: '2026-06-27T21:00:00Z', phase: 'groupes' },
  { a: 'RD Congo',           b: 'Ouzbékistan',        kickoff: '2026-06-27T21:00:00Z', phase: 'groupes' },

  // ── Groupe L ─────────────────────────────────────────────────────────────────
  { a: 'Angleterre',         b: 'Croatie',            kickoff: '2026-06-17T18:00:00Z', phase: 'groupes' },
  { a: 'Ghana',              b: 'Panama',             kickoff: '2026-06-17T21:00:00Z', phase: 'groupes' },
  { a: 'Angleterre',         b: 'Ghana',              kickoff: '2026-06-23T18:00:00Z', phase: 'groupes' },
  { a: 'Panama',             b: 'Croatie',            kickoff: '2026-06-23T21:00:00Z', phase: 'groupes' },
  { a: 'Panama',             b: 'Angleterre',         kickoff: '2026-06-27T22:00:00Z', phase: 'groupes' },
  { a: 'Croatie',            b: 'Ghana',              kickoff: '2026-06-27T22:00:00Z', phase: 'groupes' },
]

// ─── Phases éliminatoires (32 matchs) — nations "À Déterminer" ───────────────

const TBD = 'À Déterminer'

// Tour de 32 (huitièmes) : 16 matchs du 28 juin au 5 juillet — multiplier x1.2
const TOUR_32: MatchDef[] = [
  { a: TBD, b: TBD, kickoff: '2026-06-28T18:00:00Z', phase: 'huitiemes', multiplier: 1.2 },
  { a: TBD, b: TBD, kickoff: '2026-06-28T21:00:00Z', phase: 'huitiemes', multiplier: 1.2 },
  { a: TBD, b: TBD, kickoff: '2026-06-29T18:00:00Z', phase: 'huitiemes', multiplier: 1.2 },
  { a: TBD, b: TBD, kickoff: '2026-06-29T21:00:00Z', phase: 'huitiemes', multiplier: 1.2 },
  { a: TBD, b: TBD, kickoff: '2026-06-30T18:00:00Z', phase: 'huitiemes', multiplier: 1.2 },
  { a: TBD, b: TBD, kickoff: '2026-06-30T21:00:00Z', phase: 'huitiemes', multiplier: 1.2 },
  { a: TBD, b: TBD, kickoff: '2026-07-01T18:00:00Z', phase: 'huitiemes', multiplier: 1.2 },
  { a: TBD, b: TBD, kickoff: '2026-07-01T21:00:00Z', phase: 'huitiemes', multiplier: 1.2 },
  { a: TBD, b: TBD, kickoff: '2026-07-02T18:00:00Z', phase: 'huitiemes', multiplier: 1.2 },
  { a: TBD, b: TBD, kickoff: '2026-07-02T21:00:00Z', phase: 'huitiemes', multiplier: 1.2 },
  { a: TBD, b: TBD, kickoff: '2026-07-03T18:00:00Z', phase: 'huitiemes', multiplier: 1.2 },
  { a: TBD, b: TBD, kickoff: '2026-07-03T21:00:00Z', phase: 'huitiemes', multiplier: 1.2 },
  { a: TBD, b: TBD, kickoff: '2026-07-04T18:00:00Z', phase: 'huitiemes', multiplier: 1.2 },
  { a: TBD, b: TBD, kickoff: '2026-07-04T21:00:00Z', phase: 'huitiemes', multiplier: 1.2 },
  { a: TBD, b: TBD, kickoff: '2026-07-05T18:00:00Z', phase: 'huitiemes', multiplier: 1.2 },
  { a: TBD, b: TBD, kickoff: '2026-07-05T21:00:00Z', phase: 'huitiemes', multiplier: 1.2 },
]

// Tour de 16 : 8 matchs du 6 au 9 juillet — multiplier x1.4
const TOUR_16: MatchDef[] = [
  { a: TBD, b: TBD, kickoff: '2026-07-06T18:00:00Z', phase: 'quarts', multiplier: 1.4 },
  { a: TBD, b: TBD, kickoff: '2026-07-06T21:00:00Z', phase: 'quarts', multiplier: 1.4 },
  { a: TBD, b: TBD, kickoff: '2026-07-07T18:00:00Z', phase: 'quarts', multiplier: 1.4 },
  { a: TBD, b: TBD, kickoff: '2026-07-07T21:00:00Z', phase: 'quarts', multiplier: 1.4 },
  { a: TBD, b: TBD, kickoff: '2026-07-08T18:00:00Z', phase: 'quarts', multiplier: 1.4 },
  { a: TBD, b: TBD, kickoff: '2026-07-08T21:00:00Z', phase: 'quarts', multiplier: 1.4 },
  { a: TBD, b: TBD, kickoff: '2026-07-09T18:00:00Z', phase: 'quarts', multiplier: 1.4 },
  { a: TBD, b: TBD, kickoff: '2026-07-09T21:00:00Z', phase: 'quarts', multiplier: 1.4 },
]

// Quarts de finale : 4 matchs du 11 au 13 juillet — multiplier x1.4
const QUARTS: MatchDef[] = [
  { a: TBD, b: TBD, kickoff: '2026-07-11T18:00:00Z', phase: 'quarts', multiplier: 1.4 },
  { a: TBD, b: TBD, kickoff: '2026-07-11T21:00:00Z', phase: 'quarts', multiplier: 1.4 },
  { a: TBD, b: TBD, kickoff: '2026-07-12T21:00:00Z', phase: 'quarts', multiplier: 1.4 },
  { a: TBD, b: TBD, kickoff: '2026-07-13T21:00:00Z', phase: 'quarts', multiplier: 1.4 },
]

// Demi-finales : 2 matchs — multiplier x1.6
const DEMIS: MatchDef[] = [
  { a: TBD, b: TBD, kickoff: '2026-07-14T21:00:00Z', phase: 'demis', multiplier: 1.6 },
  { a: TBD, b: TBD, kickoff: '2026-07-15T21:00:00Z', phase: 'demis', multiplier: 1.6 },
]

// Finale 3e place + Finale
const FINALES: MatchDef[] = [
  { a: TBD, b: TBD, kickoff: '2026-07-18T18:00:00Z', phase: 'finale_3eme', multiplier: 1.4 },
  { a: TBD, b: TBD, kickoff: '2026-07-19T21:00:00Z', phase: 'finale',      multiplier: 2.0 },
]

const ALL_MATCHES: MatchDef[] = [
  ...GROUP_MATCHES,
  ...TOUR_32,
  ...TOUR_16,
  ...QUARTS,
  ...DEMIS,
  ...FINALES,
]

// ─── Fonction principale d'import ─────────────────────────────────────────────

export type ImportResult = {
  error?: string
  nations_new: number
  nations_existing: number
  matches_inserted: number
  matches_skipped: number
  total_matches: number
  details: string[]
}

export async function importWorldCup(): Promise<ImportResult> {
  const admin = createAdminClient()
  const details: string[] = []

  const zero = { nations_new: 0, nations_existing: 0, matches_inserted: 0, matches_skipped: 0, total_matches: ALL_MATCHES.length, details }

  // ── 1. Nations — upsert ignoreDuplicates ────────────────────────────────────

  const nationsPayload = [...NATIONS_DATA, { name: 'À Déterminer', code: 'TBD' }]

  const { error: upsertNationsError } = await admin
    .from('cdm_nations')
    .upsert(nationsPayload, { onConflict: 'name', ignoreDuplicates: true })

  if (upsertNationsError) {
    return { error: `Upsert nations: ${upsertNationsError.message}`, ...zero }
  }

  // Recharge toutes les nations pour construire la map id
  const { data: allNations, error: loadNationsError } = await admin
    .from('cdm_nations')
    .select('id, name')

  if (loadNationsError) {
    return { error: `Chargement nations: ${loadNationsError.message}`, ...zero }
  }

  const nationIdByName = new Map<string, string>(
    (allNations ?? []).map(n => [n.name, n.id])
  )

  const nations_existing = (allNations ?? []).length
  const nations_new = nationsPayload.filter(n => !nationIdByName.has(n.name)).length

  details.push(`Nations en base: ${nations_existing}`)

  const tbdId = nationIdByName.get('À Déterminer')
  if (!tbdId) {
    return { error: 'Nation "À Déterminer" introuvable après upsert', ...zero }
  }

  // ── 2. Matchs — upsert idempotent (contrainte unique nation_a_id,nation_b_id,kickoff_at) ──

  type MatchRow = {
    nation_a_id:       string
    nation_b_id:       string
    kickoff_at:        string
    phase:             string
    status:            string
    points_multiplier: number
  }

  const matchesToInsert: MatchRow[] = []
  let matches_skipped = 0

  for (const m of ALL_MATCHES) {
    const nationAId = m.a === TBD ? tbdId : nationIdByName.get(m.a)
    const nationBId = m.b === TBD ? tbdId : nationIdByName.get(m.b)

    if (!nationAId || !nationBId) {
      details.push(`⚠ Nation inconnue: "${m.a}" ou "${m.b}" — ignoré`)
      matches_skipped++
      continue
    }

    matchesToInsert.push({
      nation_a_id:       nationAId,
      nation_b_id:       nationBId,
      kickoff_at:        m.kickoff,
      phase:             m.phase,
      status:            'a_venir',
      points_multiplier: m.multiplier ?? 1,
    })
  }

  const { error: upsertMatchesError } = await admin
    .from('cdm_matches')
    .upsert(matchesToInsert, { onConflict: 'nation_a_id,nation_b_id,kickoff_at', ignoreDuplicates: true })

  if (upsertMatchesError) {
    return {
      error: `Upsert matchs: ${upsertMatchesError.message}`,
      nations_new, nations_existing, matches_inserted: 0, matches_skipped,
      total_matches: ALL_MATCHES.length, details,
    }
  }

  const matches_inserted = matchesToInsert.length
  details.push(`Matchs upsertés: ${matches_inserted} | Nations inconnues ignorées: ${matches_skipped}`)

  return { nations_new, nations_existing, matches_inserted, matches_skipped, total_matches: ALL_MATCHES.length, details }
}
