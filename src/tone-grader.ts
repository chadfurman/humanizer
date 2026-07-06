// Deterministic "AI-ness" scorer for prose. Higher aiScore = reads more like AI.
// Signals are drawn from tone research plus a private human-writing corpus. No
// single signal is conclusive; the score is a weighted cluster of tells. Pair it
// with the LLM judge (judge.ts) and a supervised detector (detector/) for a
// three-angle read — each fails differently, so agreement is the signal.

export interface ToneMetrics {
  words: number;
  sentences: number;
  emDashPer1k: number;
  tricolons: number;
  hedges: number;
  signposts: number;
  aiVocab: number;
  copulaAvoid: number;
  quips: number;
  inflation: number;
  negParallel: number;
  fromXtoY: number;
  transitionsPer1k: number;
  burstiness: number; // stdev of sentence word-counts; LOW is AI-like
  contractionsPer100: number; // corpus baseline ~1.2-4.9; AI-formal prose goes low
  startDiversity: number; // unique sentence-openers / sentences; corpus ~0.56-0.75
  aiScore: number; // 0-100, higher = more AI
  hits: Record<string, string[]>;
}

const HEDGES = [
  "it's worth noting", 'it is worth noting', 'arguably', 'potentially',
  'it could be said', 'it is important to note', "it's important to note",
  'that said', 'to be fair', 'in many ways', 'one might argue',
];
const SIGNPOSTS = [
  "let's dive in", "let's dive into", 'in this section', 'in this post',
  'in conclusion', 'to sum up', 'in summary', 'first and foremost',
  'without further ado', 'at the end of the day', 'when it comes to',
];
const AI_VOCAB = [
  'delve', 'delved', 'delving', 'tapestry', 'underscore', 'underscores',
  'leverage', 'leverages', 'leveraging', 'showcase', 'showcases',
  'meticulous', 'meticulously', 'intricate', 'seamless', 'seamlessly',
  'robust', 'realm', 'testament', 'landscape', 'navigate', 'navigating',
  'foster', 'crucial', 'vital', 'pivotal', 'harness', 'elevate', 'unlock',
  'empower', 'ever-evolving', 'deep dive', 'game-changer', 'cutting-edge',
  'utilize', 'utilizing', 'commence', 'plethora', 'myriad', 'boasts',
];
const COPULA_AVOID = ['serves as', 'stands as', 'acts as a', 'boasts a', 'boasts an'];
// The OTHER AI failure mode: try-hard internet-quip flavor. Formal-AI tells
// above; these are punchy-AI tells (2024-26 vintage).
const QUIPS = [
  'the receipts', 'with receipts', 'no notes', "chef's kiss", 'hits different',
  'no mercy', 'let that sink in', 'rent free', "it's giving", 'understood the assignment',
  'we love to see it', 'living my best', 'built different', '*mic drop*', 'mic drop',
  'and honestly?', 'chaotic energy', 'main character', 'plot twist:', 'spoiler:',
  'spoiler alert', 'the math is mathing', 'stay tuned', 'buckle up', 'wild ride',
  'the money shot', 'and yeah,', 'not gonna lie',
];
// Short slang tokens need word boundaries (plain indexOf matched "single").
const QUIP_TOKENS = /\b(ngl|lowkey|low-key|iykyk|fr fr|deadass)\b/gi;
const TRANSITIONS = ['furthermore', 'moreover', 'additionally', 'consequently', 'nevertheless', 'notably', 'importantly'];
// Adverb inflation + fake hedges: weight low — humans use these too, it's the
// density that reads AI.
const INFLATION = [
  'fundamentally', 'essentially', 'inherently', 'ultimately', 'profoundly',
  'undeniably', 'undoubtedly', 'seamlessly', 'effortlessly', 'remarkably',
  'critically important', 'deeply personal', 'truly unique',
];

function countMatches(text: string, phrases: string[]): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const p of phrases) {
    let i = 0;
    while ((i = lower.indexOf(p, i)) !== -1) { hits.push(p); i += p.length; }
  }
  return hits;
}

function regexHits(text: string, re: RegExp): string[] {
  return (text.match(re) ?? []).map((m) => m.trim());
}

export function scoreText(raw: string): ToneMetrics {
  const text = raw.trim();
  const words = (text.match(/\b[\w'-]+\b/g) ?? []).length || 1;
  const sentenceParts = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const sentLens = sentenceParts.map((s) => (s.match(/\b[\w'-]+\b/g) ?? []).length).filter((n) => n > 0);
  const sentences = sentLens.length || 1;

  const emDashes = regexHits(text, /—/g).length;
  const tricolonHits = regexHits(text, /\b[\w'-]+, [\w'-][^,.]*, and [^,.]+/gi);
  const hedgeHits = countMatches(text, HEDGES);
  const signpostHits = countMatches(text, SIGNPOSTS);
  const aiVocabHits = countMatches(text, AI_VOCAB.map((w) => ' ' + w)).map((s) => s.trim());
  const copulaHits = countMatches(text, COPULA_AVOID);
  const quipHits = [...countMatches(text, QUIPS), ...regexHits(text, QUIP_TOKENS)];
  const inflationHits = countMatches(text, INFLATION.map((w) => ' ' + w)).map((w) => w.trim());
  const negParallelHits = [
    ...regexHits(text, /it'?s not (just |only )?[^,.]+,? (but|it'?s) /gi),
    ...regexHits(text, /\bnot (just|only) [^,.]+,? but\b/gi),
    // the "X isn't Y, it's Z" family — the same negate-then-reframe crutch
    ...regexHits(text, /\b\w+ (isn'?t|aren'?t|wasn'?t|weren'?t|doesn'?t|didn'?t|won'?t) [^,.]{2,40},? (it'?s|they'?re|that'?s|it|they) /gi),
  ];
  const fromToHits = regexHits(text, /\bfrom [^,.]{3,40} to [^,.]{3,40}/gi);
  const transitionHits = countMatches(text, TRANSITIONS.map((w) => w + ',')).concat(
    countMatches(text, TRANSITIONS.map((w) => w + ' ')),
  );

  const mean = sentLens.reduce((a, b) => a + b, 0) / sentences;
  const variance = sentLens.reduce((a, b) => a + (b - mean) ** 2, 0) / sentences;
  const burstiness = Math.sqrt(variance);

  // Corpus-relative texture (baselines from a human-writing corpus:
  // contractions/100w ~1.2-4.9, sentence-start diversity ~0.56-0.75).
  const contractions = (text.match(/\b[\w]+'(s|t|re|ve|ll|d|m)\b/gi) ?? []).length;
  const contractionsPer100 = (contractions / words) * 100;
  const starts = sentenceParts
    .filter((snt) => (snt.match(/\b[\w'-]+\b/g) ?? []).length > 2)
    .map((snt) => (snt.match(/[A-Za-z']+/)?.[0] ?? '').toLowerCase())
    .filter(Boolean);
  const startDiversity = starts.length ? new Set(starts).size / starts.length : 1;

  const per1k = (n: number) => (n / words) * 1000;
  const emDashPer1k = per1k(emDashes);
  const transitionsPer1k = per1k(transitionHits.length);

  // Weighted AI score. Density signals scaled per-1k; structural signals capped.
  let score = 0;
  score += Math.min(emDashPer1k * 6, 22);            // em-dash overuse
  score += Math.min(tricolonHits.length * 4, 16);     // rule-of-three
  score += Math.min(hedgeHits.length * 5, 15);
  score += Math.min(signpostHits.length * 6, 12);
  score += Math.min(aiVocabHits.length * 5, 20);
  score += Math.min(copulaHits.length * 4, 8);
  score += Math.min(quipHits.length * 6, 18);         // quip-tic flavor
  score += Math.min(Math.max(0, inflationHits.length - 1) * 3, 9); // adverb inflation (first one free)
  score += Math.min(negParallelHits.length * 6, 12);
  score += Math.min(fromToHits.length * 4, 8);
  score += Math.min(transitionsPer1k * 3, 10);
  if (sentences >= 4 && burstiness < 6) score += (6 - burstiness) * 2.5; // low burstiness penalty
  // Texture deltas vs the human corpus (only on texts big enough to trust).
  if (words >= 120 && contractionsPer100 < 0.8) score += (0.8 - contractionsPer100) * 8; // stiff, uncontracted prose
  if (starts.length >= 8 && startDiversity < 0.45) score += (0.45 - startDiversity) * 30; // The... The... It... It...

  return {
    words, sentences,
    emDashPer1k: +emDashPer1k.toFixed(2),
    tricolons: tricolonHits.length,
    hedges: hedgeHits.length,
    signposts: signpostHits.length,
    aiVocab: aiVocabHits.length,
    copulaAvoid: copulaHits.length,
    quips: quipHits.length,
    inflation: inflationHits.length,
    negParallel: negParallelHits.length,
    fromXtoY: fromToHits.length,
    transitionsPer1k: +transitionsPer1k.toFixed(2),
    burstiness: +burstiness.toFixed(2),
    contractionsPer100: +contractionsPer100.toFixed(2),
    startDiversity: +startDiversity.toFixed(2),
    aiScore: Math.round(Math.min(score, 100)),
    hits: {
      emDash: emDashes ? [`${emDashes}×`] : [],
      tricolon: tricolonHits, hedges: hedgeHits, signposts: signpostHits,
      aiVocab: aiVocabHits, copulaAvoid: copulaHits, quips: quipHits, inflation: inflationHits, negParallel: negParallelHits,
      fromXtoY: fromToHits,
    },
  };
}
