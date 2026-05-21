'use client';

import { motion, useInView, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Goal,
  Shield,
  Sparkles,
  Star,
  Swords,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { FormationPitch } from '@/components/match/FormationPitch';
import { RichRadarPentagon } from '@/components/match/RichRadarPentagon';

// ============================================================================
// Données mockées — reflète exactement la sortie réelle d'une analyse deep
// (DeepPreMatchAnalysis + MatchRichData). Match : Bologna - Inter.
// ============================================================================

const PREDICTION: {
  summary: string;
  scoreline_guess: string;
  probabilities: { home_win: number; draw: number; away_win: number };
  btts: 'yes' | 'no';
  btts_reason: string;
  over_2_5: 'yes' | 'no';
  over_2_5_reason: string;
  confidence: 'low' | 'medium' | 'high';
} = {
  summary:
    "L'Inter aborde ce déplacement à Bologne en favori clair. Leur supériorité statistique se traduit autant à l'avant qu'en défense, et la dynamique récente confirme la hiérarchie. Bologne reste capable d'inquiéter à domicile mais doit composer avec des absences qui pèsent.",
  scoreline_guess: '0 - 2',
  probabilities: { home_win: 15, draw: 20, away_win: 65 },
  btts: 'no',
  btts_reason: '18 clean sheets cette saison côté Inter, Bologne muet 11 fois.',
  over_2_5: 'yes',
  over_2_5_reason: 'Inter cumule 2,3 buts/match cette saison, et 4 des 5 derniers ont dépassé 2,5 buts.',
  confidence: 'high',
};

const SCENARIOS = [
  {
    title: 'Domination Inter, but tardif des visiteurs',
    narrative:
      "Inter contrôle la possession dès l'entame et étouffe les sorties de balle adverses. Bologne tient le 0-0 jusqu'à la mi-temps mais cède sur un débordement de Dimarco. Lautaro double la mise dans le money time.",
    likelihood: 'élevée' as const,
  },
  {
    title: "Match fermé décidé sur coup de pied arrêté",
    narrative:
      "Bologne défend bas et limite l'Inter à la tentative lointaine. Le match s'enlise puis bascule sur un corner pour les visiteurs. 0-1, Inter gère.",
    likelihood: 'moyenne' as const,
  },
  {
    title: 'Bologne réagit, partage des points',
    narrative:
      "Orsolini s'allume tôt et trouve la lucarne, mettant Bologne devant. L'Inter égalise rapidement et la fin de match s'équilibre. Nul logique.",
    likelihood: 'faible' as const,
  },
];

const DATA_INSIGHT =
  "Le différentiel offensif est massif (+92 % de buts pour l'Inter) mais le facteur déterminant reste la fragilité défensive bolognaise à domicile (1,5 but encaissé/match). Les indisponibles côté maison amplifient ce déséquilibre.";

const STATS_COMPARE: Array<{
  label: string;
  home: string;
  away: string;
  advantage: 'home' | 'away' | 'equal';
}> = [
  { label: 'Buts/match (saison)', home: '1.2', away: '2.3', advantage: 'away' },
  { label: 'Buts encaissés/match', home: '1.5', away: '0.9', advantage: 'away' },
  { label: 'Clean sheets', home: '8', away: '18', advantage: 'away' },
  { label: 'Forme (10 derniers)', home: '4V-2N-4D', away: '8V-1N-1D', advantage: 'away' },
  { label: 'Possession moyenne', home: '47 %', away: '58 %', advantage: 'away' },
];

const RADAR_DIMS = [
  { label: 'Attaque', home: 58, away: 82 },
  { label: 'Défense', home: 62, away: 88 },
  { label: 'Forme', home: 45, away: 86 },
  { label: 'Régularité', home: 71, away: 79 },
  { label: 'Globale', home: 59, away: 82 },
];

const FORM_HOME: ('W' | 'D' | 'L')[] = ['W', 'W', 'D', 'L', 'L'];
const FORM_AWAY: ('W' | 'D' | 'L')[] = ['W', 'D', 'W', 'W', 'D'];

const H2H = { home_wins: 3, draws: 4, away_wins: 8, total: 15 };

const FORMATIONS = { home: '4-2-3-1', away: '3-5-2' };

const TOP_PLAYERS = {
  home: [
    {
      name: 'R. Orsolini',
      position: 'AD',
      is_captain: false,
      appearances: 31,
      goals: 10,
      assists: 8,
      rating: 7.1,
      key_passes: 47,
    },
    {
      name: 'L. Ferguson',
      position: 'MC',
      is_captain: true,
      appearances: 28,
      goals: 7,
      assists: 4,
      rating: 7.0,
      key_passes: 32,
    },
  ],
  away: [
    {
      name: 'Lautaro Martínez',
      position: 'BU',
      is_captain: true,
      appearances: 34,
      goals: 17,
      assists: 5,
      rating: 7.6,
      key_passes: 41,
    },
    {
      name: 'N. Barella',
      position: 'MC',
      is_captain: false,
      appearances: 30,
      goals: 4,
      assists: 9,
      rating: 7.4,
      key_passes: 55,
    },
  ],
};

const ABSENTS = {
  home: [
    { name: 'Calafiori', reason: 'suspendu' },
    { name: 'Saelemaekers', reason: 'blessure cuisse' },
    { name: 'El Azzouzi', reason: 'reprise individuelle' },
  ],
  away: [{ name: 'Acerbi', reason: 'blessure mollet' }],
};

const TACTICAL = {
  home_approach:
    "Bologne va défendre bas dans un 4-2-3-1 compact, comptant sur les transitions rapides via Orsolini sur le côté droit pour exploiter l'espace dans le dos d'Acerbi.",
  away_approach:
    "L'Inter prend la possession dans son 3-5-2 habituel, avec Dimarco-Dumfries qui apportent la largeur et Calhanoglu qui distribue depuis l'axe.",
  key_battle:
    'Lautaro Martínez vs Calafiori absent : la défense bolognaise est rebattue, ouvrant des couloirs centraux que l\'Inter sait exploiter.',
};

const FORM_NARRATIVE = {
  home:
    "Bologne sort d'une série mitigée (2V-1N-2D sur 5) avec deux défaites consécutives à l'extérieur. À domicile la dynamique est meilleure mais les blessures pèsent.",
  away:
    "L'Inter aligne 4 victoires sur les 5 derniers matchs et n'a encaissé qu'un seul but sur cette série. Confiance et automatismes en place.",
};

const KEY_PLAYERS_AI = {
  home: [
    {
      name: 'R. Orsolini',
      why: "Principal danger offensif, capable de débloquer sur action individuelle. Sa forme dépendra de la qualité de couverture défensive bolognaise.",
    },
  ],
  away: [
    {
      name: 'Lautaro Martínez',
      why: 'Capitaine et premier buteur de la saison, profitera de l\'absence de Calafiori pour attaquer la profondeur.',
    },
    {
      name: 'N. Barella',
      why: 'Récupération + projection : il dictera le tempo des transitions inter-lignes.',
    },
  ],
};

const WEAK_POINTS = {
  home:
    '11 matchs sans marquer cette saison, dont 4 à domicile. La perte de Calafiori désorganise la charnière centrale au pire moment.',
  away:
    "3 défaites sur 18 matchs à l'extérieur. L'Inter peut relâcher quand la victoire semble acquise et se faire surprendre en fin de rencontre.",
};

// ============================================================================
// Helpers
// ============================================================================

const LIKELIHOOD_STYLES = {
  élevée: { bg: 'border-primary/30 bg-primary/5', text: 'text-primary', label: 'Probabilité élevée' },
  moyenne: { bg: 'border-amber-500/30 bg-amber-500/5', text: 'text-amber-500', label: 'Probabilité moyenne' },
  faible: { bg: 'border-border bg-muted/40', text: 'text-muted-foreground', label: 'Probabilité faible' },
} as const;

const formColor = (r: string) =>
  r === 'W'
    ? 'bg-primary/20 text-primary'
    : r === 'D'
      ? 'bg-amber-500/20 text-amber-500'
      : 'bg-destructive/20 text-destructive';

const ratingColor = (r: number): string => {
  if (r >= 7.5) return 'bg-primary text-primary-foreground';
  if (r >= 6.8) return 'bg-emerald-500/30 text-emerald-300';
  if (r >= 6.0) return 'bg-amber-500/30 text-amber-300';
  return 'bg-destructive/30 text-destructive';
};

const HOME = 'Bologna FC 1909';
const AWAY = 'FC Internazionale Milano';

// ============================================================================
// Composant
// ============================================================================

export function LandingDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const cardRotate = useTransform(scrollYProgress, [0, 0.4, 1], [8, 0, -5]);
  const cardY = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section ref={sectionRef} id="demo" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-12 max-w-2xl text-center"
        >
          <p className="text-primary mb-2 text-xs font-semibold tracking-widest uppercase">
            Une vraie analyse, pas une fiche de stats
          </p>
          <h2 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Ce qu&apos;on te livre en 15 secondes
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Verdict, scénarios, probabilités, comparaison statistique, formations,
            top joueurs, indisponibles, lecture tactique. Pas un chiffre brut sans
            contexte.
          </p>
        </motion.div>

        <div
          ref={ref}
          className="relative mx-auto max-w-4xl"
          style={{ perspective: '1500px' }}
        >
          {/* Halos respirants */}
          <motion.div
            className="bg-primary/15 pointer-events-none absolute -inset-6 -z-10 rounded-3xl blur-3xl"
            animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="bg-emerald-400/10 pointer-events-none absolute -inset-2 -z-10 rounded-3xl blur-2xl"
            animate={{ scale: [1.05, 1, 1.05], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{
              rotateX: cardRotate,
              y: cardY,
              transformStyle: 'preserve-3d',
            }}
            className="bg-card border-border space-y-7 rounded-2xl border p-6 shadow-2xl sm:p-8"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="text-primary size-5" aria-hidden />
                <h3 className="text-sm font-semibold">Analyse pré-match</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  Mode deep
                </span>
                <span className="bg-emerald-500/10 text-emerald-500 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  Démo
                </span>
              </div>
            </div>

            {/* Match meta */}
            <div className="border-border flex items-center justify-between border-y py-4">
              <div>
                <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                  Serie A · Journée 38 · Stadio Renato Dall&apos;Ara
                </p>
                <p className="mt-1 text-lg font-semibold sm:text-xl">
                  Bologna FC <span className="text-muted-foreground">vs</span>{' '}
                  Inter Milano
                </p>
              </div>
              <p className="text-muted-foreground text-xs tabular-nums">
                23 mai 2026 · 16:00
              </p>
            </div>

            {/* === 1. VERDICT === */}

            {/* Prédiction synthétique */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="border-primary/30 rounded-lg border border-dashed p-4"
            >
              <p className="text-muted-foreground mb-2 text-[10px] tracking-wide uppercase">
                Prédiction
              </p>
              <p className="text-sm leading-relaxed">{PREDICTION.summary}</p>
              <p className="text-primary mt-2 text-sm font-semibold tabular-nums">
                Score plausible : {PREDICTION.scoreline_guess}
              </p>
            </motion.div>

            {/* Scénarios */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.25, duration: 0.5 }}
            >
              <h4 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                Scénarios possibles
              </h4>
              <div className="space-y-3">
                {SCENARIOS.map((s, i) => {
                  const style = LIKELIHOOD_STYLES[s.likelihood];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={inView ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.4 + i * 0.12, duration: 0.4 }}
                      className={`rounded-lg border p-4 ${style.bg}`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          Scénario #{i + 1} — {s.title}
                        </p>
                        <span
                          className={`shrink-0 text-[10px] font-semibold tracking-wide uppercase ${style.text}`}
                        >
                          {style.label}
                        </span>
                      </div>
                      <p className="text-sm">{s.narrative}</p>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Probabilités */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              <h4 className="text-muted-foreground mb-2 flex items-center gap-1 text-xs font-medium tracking-wide uppercase">
                <Trophy className="size-3.5" aria-hidden />
                Probabilités d&apos;issue
              </h4>
              <div className="space-y-2">
                {[
                  {
                    label: `${HOME} (dom.)`,
                    value: PREDICTION.probabilities.home_win,
                    color: 'bg-primary',
                  },
                  {
                    label: 'Match nul',
                    value: PREDICTION.probabilities.draw,
                    color: 'bg-muted-foreground/60',
                  },
                  {
                    label: `${AWAY} (ext.)`,
                    value: PREDICTION.probabilities.away_win,
                    color: 'bg-primary',
                  },
                ].map((row, i) => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate">{row.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {row.value}%
                      </span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={inView ? { width: `${row.value}%` } : {}}
                        transition={{ delay: 0.85 + i * 0.15, duration: 0.9, ease: 'easeOut' }}
                        className={`h-full ${row.color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* BTTS + Over */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 1.1, duration: 0.5 }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <div className="border-border rounded-lg border p-3">
                <p className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px] uppercase">
                  <Goal className="size-3" aria-hidden />
                  Les 2 équipes marquent
                </p>
                <p className="text-sm font-semibold">{PREDICTION.btts === 'yes' ? 'Oui' : 'Non'}</p>
                <p className="text-muted-foreground mt-1 text-xs">{PREDICTION.btts_reason}</p>
              </div>
              <div className="border-border rounded-lg border p-3">
                <p className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px] uppercase">
                  <TrendingUp className="size-3" aria-hidden />
                  Plus de 2.5 buts
                </p>
                <p className="text-sm font-semibold">{PREDICTION.over_2_5 === 'yes' ? 'Oui' : 'Non'}</p>
                <p className="text-muted-foreground mt-1 text-xs">{PREDICTION.over_2_5_reason}</p>
              </div>
            </motion.div>

            {/* Confiance */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 1.25, duration: 0.5 }}
            >
              <h4 className="text-muted-foreground mb-2 flex items-center gap-1 text-xs font-medium tracking-wide uppercase">
                <Shield className="size-3.5" aria-hidden />
                Confiance de l&apos;IA
              </h4>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <motion.div
                  initial={{ width: 0 }}
                  animate={inView ? { width: '90%' } : {}}
                  transition={{ delay: 1.35, duration: 0.8, ease: 'easeOut' }}
                  className="bg-primary h-full"
                />
              </div>
              <p className="text-muted-foreground mt-1 text-right text-xs">Élevée</p>
            </motion.div>

            {/* Insight */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 1.4, duration: 0.5 }}
              className="bg-muted/40 rounded-lg p-4"
            >
              <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Ce que disent les chiffres
              </h4>
              <p className="text-sm leading-relaxed">{DATA_INSIGHT}</p>
            </motion.div>

            {/* Séparateur */}
            <div className="border-border border-t pt-1">
              <p className="text-muted-foreground/60 -mb-1 text-center text-[10px] tracking-widest uppercase">
                ◆ Données détaillées ◆
              </p>
            </div>

            {/* === 2. DONNÉES === */}

            {/* Comparaison statistique */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 1.55, duration: 0.5 }}
            >
              <h4 className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                <Activity className="size-3.5" aria-hidden />
                Comparaison statistique
              </h4>
              <div className="border-border overflow-hidden rounded-xl border">
                <div className="bg-muted/30 grid grid-cols-[1fr_2fr_1fr] items-center border-b px-3 py-2 text-[10px] font-semibold tracking-wide uppercase">
                  <span className="text-primary text-right">Bologna</span>
                  <span className="text-muted-foreground text-center">Statistique</span>
                  <span className="text-primary">Inter</span>
                </div>
                {STATS_COMPARE.map((s, i) => {
                  const homeBest = s.advantage === 'home';
                  return (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, x: -10 }}
                      animate={inView ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 1.65 + i * 0.05, duration: 0.4 }}
                      className="border-border grid grid-cols-[1fr_2fr_1fr] items-center border-b px-3 py-2.5 text-sm last:border-b-0"
                    >
                      <span className={`text-right tabular-nums ${homeBest ? 'text-primary font-semibold' : 'text-foreground/80'}`}>
                        {s.home}
                      </span>
                      <span className="text-muted-foreground text-center text-xs">
                        {s.label}
                      </span>
                      <span className={`tabular-nums ${!homeBest ? 'text-primary font-semibold' : 'text-foreground/80'}`}>
                        {s.away}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Radar pentagonal — le vrai composant de prod */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 1.9, duration: 0.5 }}
            >
              <h4 className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                <BarChart3 className="size-3.5" aria-hidden />
                Comparaison globale
              </h4>
              <div className="bg-muted/20 border-border rounded-xl border p-4">
                <RichRadarPentagon
                  dimensions={RADAR_DIMS}
                  home_team_name={HOME}
                  away_team_name={AWAY}
                />
              </div>
            </motion.div>

            {/* Forme récente */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 2.1, duration: 0.5 }}
            >
              <h4 className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                <TrendingUp className="size-3.5" aria-hidden />
                Forme récente · 5 derniers
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: 'Bologna', form: FORM_HOME, bilan: '2V-1N-2D' },
                  { name: 'Inter', form: FORM_AWAY, bilan: '3V-2N-0D' },
                ].map((t) => (
                  <div key={t.name} className="border-border rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold">{t.name}</span>
                      <span className="text-muted-foreground text-[10px] tabular-nums">{t.bilan}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {t.form.map((r, ri) => (
                        <span
                          key={ri}
                          className={`flex size-7 items-center justify-center rounded-md text-[11px] font-bold ${formColor(r)}`}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* H2H */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 2.25, duration: 0.5 }}
            >
              <h4 className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                <Swords className="size-3.5" aria-hidden />
                Confrontations directes · {H2H.total} matchs
              </h4>
              <div className="border-border bg-muted/20 grid grid-cols-3 overflow-hidden rounded-lg border">
                <div className="border-border border-r p-3 text-center">
                  <p className="text-primary text-2xl font-bold tabular-nums">{H2H.home_wins}</p>
                  <p className="text-muted-foreground mt-1 text-[10px] tracking-wide uppercase">Bologna</p>
                </div>
                <div className="border-border border-r p-3 text-center">
                  <p className="text-muted-foreground text-2xl font-bold tabular-nums">{H2H.draws}</p>
                  <p className="text-muted-foreground mt-1 text-[10px] tracking-wide uppercase">Nuls</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-primary text-2xl font-bold tabular-nums">{H2H.away_wins}</p>
                  <p className="text-muted-foreground mt-1 text-[10px] tracking-wide uppercase">Inter</p>
                </div>
              </div>
            </motion.div>

            {/* Formations type */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 2.4, duration: 0.5 }}
            >
              <h4 className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                <Users className="size-3.5" aria-hidden />
                Formations type
              </h4>
              <div className="flex flex-wrap items-start justify-center gap-4">
                <FormationPitch
                  formation={FORMATIONS.home}
                  team_name="Bologna"
                  variant="primary"
                />
                <FormationPitch
                  formation={FORMATIONS.away}
                  team_name="Inter"
                  variant="emerald"
                />
              </div>
            </motion.div>

            {/* Top joueurs avec ratings */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 2.55, duration: 0.5 }}
            >
              <h4 className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                <Star className="size-3.5" aria-hidden />
                Top joueurs saison
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['home', 'away'] as const).map((side) => {
                  const list = side === 'home' ? TOP_PLAYERS.home : TOP_PLAYERS.away;
                  const teamName = side === 'home' ? 'Bologna' : 'Inter';
                  return (
                    <div key={side} className="border-border bg-muted/20 rounded-lg border p-3">
                      <p className="text-muted-foreground mb-2 text-[10px] tracking-wide uppercase">{teamName}</p>
                      {list.map((p, pi) => (
                        <div
                          key={p.name}
                          className="border-border/60 flex items-center gap-3 border-t py-2 first:border-t-0 first:pt-0"
                        >
                          <div className="bg-primary/15 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                            {p.position}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {p.name}
                              {p.is_captain && <span className="text-primary ml-1.5 text-[10px] font-bold">(C)</span>}
                            </p>
                            <p className="text-muted-foreground truncate text-[11px]">
                              {p.appearances} titu · {p.goals}b/{p.assists}a · {p.key_passes} passes clés
                            </p>
                          </div>
                          <div className={`flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums ${ratingColor(p.rating)}`}>
                            {p.rating.toFixed(1)}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Indisponibles */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 2.7, duration: 0.5 }}
            >
              <h4 className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                <AlertTriangle className="size-3.5" aria-hidden />
                Indisponibles ({ABSENTS.home.length + ABSENTS.away.length})
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {(['home', 'away'] as const).map((side) => {
                  const list = side === 'home' ? ABSENTS.home : ABSENTS.away;
                  const teamName = side === 'home' ? 'Bologna' : 'Inter';
                  if (list.length === 0) return null;
                  return (
                    <div key={side} className="bg-destructive/5 border-destructive/20 rounded-lg border p-3">
                      <p className="text-muted-foreground mb-1.5 text-[10px] uppercase">{teamName}</p>
                      <ul className="space-y-1">
                        {list.map((p, i) => (
                          <li key={i} className="text-xs">
                            <span className="font-semibold">{p.name}</span>
                            <span className="text-muted-foreground"> — {p.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* === 3. NARRATIFS IA === */}

            {/* Tactique */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 2.85, duration: 0.5 }}
            >
              <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Tactique
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-muted-foreground mb-1 text-[10px] uppercase">Bologna (dom.)</p>
                  <p className="text-sm">{TACTICAL.home_approach}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-muted-foreground mb-1 text-[10px] uppercase">Inter (ext.)</p>
                  <p className="text-sm">{TACTICAL.away_approach}</p>
                </div>
              </div>
              <p className="text-foreground mt-3 text-sm">
                <span className="text-primary font-semibold">Duel clé : </span>
                {TACTICAL.key_battle}
              </p>
            </motion.div>

            {/* Lecture de la forme */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 3.0, duration: 0.5 }}
            >
              <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Lecture de la forme
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="border-border rounded-lg border p-3">
                  <p className="text-muted-foreground mb-1 text-[10px] uppercase">Bologna</p>
                  <p className="text-sm">{FORM_NARRATIVE.home}</p>
                </div>
                <div className="border-border rounded-lg border p-3">
                  <p className="text-muted-foreground mb-1 text-[10px] uppercase">Inter</p>
                  <p className="text-sm">{FORM_NARRATIVE.away}</p>
                </div>
              </div>
            </motion.div>

            {/* Joueurs à surveiller (IA) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 3.15, duration: 0.5 }}
            >
              <h4 className="text-muted-foreground mb-2 flex items-center gap-1 text-xs font-medium tracking-wide uppercase">
                <Users className="size-3.5" aria-hidden />
                Joueurs à surveiller
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  { label: 'Bologna', list: KEY_PLAYERS_AI.home },
                  { label: 'Inter', list: KEY_PLAYERS_AI.away },
                ]).map(({ label, list }) => (
                  <div key={label}>
                    <p className="text-muted-foreground mb-2 text-[10px] uppercase">{label}</p>
                    <ul className="space-y-2">
                      {list.map((p) => (
                        <li key={p.name} className="text-sm">
                          <span className="text-primary font-semibold">{p.name}</span> — {p.why}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Points faibles */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 3.3, duration: 0.5 }}
            >
              <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Points faibles
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-destructive/5 border-destructive/20 rounded-lg border p-3">
                  <p className="text-muted-foreground mb-1 text-[10px] uppercase">Bologna</p>
                  <p className="text-sm">{WEAK_POINTS.home}</p>
                </div>
                <div className="bg-destructive/5 border-destructive/20 rounded-lg border p-3">
                  <p className="text-muted-foreground mb-1 text-[10px] uppercase">Inter</p>
                  <p className="text-sm">{WEAK_POINTS.away}</p>
                </div>
              </div>
            </motion.div>

            {/* Footer démo */}
            <p className="text-muted-foreground/70 text-right text-[10px]">
              Démonstration · Basée sur la sortie réelle d&apos;une analyse pré-match deep · GPT-4o-mini
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
