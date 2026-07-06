// LLM-as-judge (Gemini, temp 0, rubric-based). The deterministic grader counts
// tells; this judges what counting can't — and, beyond just "does it read AI,"
// scores the POSITIVE human qualities: authentic lived experience, creative
// messiness, critical thinking, and whether the writing carries any emotion or
// impact at all. Optionally calibrate with your OWN human-written excerpts.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RUBRIC = `You are judging a piece of writing on how HUMAN it reads and how much it lands.
Humans write from lived experience with creative imperfection, real critical thinking, and the
natural messiness of actual thought. AI writing is predictable, structurally neat, evenly
weighted, and emotionally hollow. Judge with specific quoted evidence on every axis.

Return STRICT JSON with these fields:
{
  "score": <0-10 overall: 10 = indistinguishable from a real person's own writing, 0 = obviously AI>,
  "verdict": "<one or two sentences, plain>",

  "authenticity": <0-10>,
  "authenticity_notes": "<what earns or loses it — judge ALL of:
     - LIVED EXPERIENCE: named places, sensory detail, real memories, a specific identity behind the words (vs plausible generalities from nowhere)
     - CREATIVE MESSINESS: tangents, asides, subplots, unresolved threads, imperfection (vs tidy, formulaic, symmetric structure)
     - CRITICAL THINKING: a real argument or contrarian, nuanced take the writer actually holds (vs safe, balanced, view-from-nowhere summary)
     - TRUSTS THE READER: makes its point without over-explaining or leaning on AI structural crutches (vs hand-holding and tidy morals)>",

  "emotion_impact": <0-10>,
  "emotion_impact_notes": "<does it make you FEEL anything or leave an impression? Reward stakes, vulnerability, a distinct voice, a line that lands and stays. Penalize hollow enthusiasm, flat corporate affect, motivational-poster endings, and prose that is competent but dead. Quote the line that lands (or note that none does).>",

  "ai_crutches": ["<quote each structural AI crutch found, e.g. an \"It's not X, it's Y\" line, an em-dash chain, a rule-of-three, a tidy-moral ending, a 'in conclusion' signpost. Empty array if genuinely none.>"],

  "worst_lines": [{"quote": "<exact>", "why": "<why it reads AI or falls flat>", "rewrite": "<a more human version>"}],

  "would_a_human_type_this": <true|false>
}
Max 5 worst_lines. Quote exactly. Be a harsh, specific grader — hedging helps no one.
CRUCIAL: structural-crutch density caps human-likeness. If you list 3+ ai_crutches, "score" must be ≤ 6; 5+ crutches, ≤ 4. A distinctive voice built on repeated negate-then-reframe scaffolding ("X isn't Y, it's Z") is still formulaic. authenticity may stay high (the voice and specifics are real); the overall score reflects the scaffolding.`;

export interface JudgeResult {
  score: number;
  verdict: string;
  authenticity: number;
  authenticity_notes: string;
  emotion_impact: number;
  emotion_impact_notes: string;
  ai_crutches: string[];
  worst_lines: { quote: string; why: string; rewrite: string }[];
  would_a_human_type_this: boolean;
}

function stripFrontmatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
}

/** Load up to 3 human-written excerpts from a dir (.md/.txt) for calibration. */
export function loadExemplars(dir: string): string {
  if (!existsSync(dir)) return '';
  const bits = readdirSync(dir)
    .filter((f) => /\.(md|txt)$/.test(f))
    .slice(0, 3)
    .map((f) => stripFrontmatter(readFileSync(join(dir, f), 'utf8')).slice(0, 900))
    .filter(Boolean);
  if (!bits.length) return '';
  return `\n\nHuman-written excerpts for calibration (match the STYLE and texture, not the content):\n---\n${bits.join('\n---\n')}`;
}

export async function judgeText(body: string, key: string, exemplars = ''): Promise<JudgeResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${RUBRIC}${exemplars}\n\nText to judge:\n---\n${body.slice(0, 20000)}` }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    },
  );
  if (!res.ok) throw new Error(`gemini judge failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { candidates: { content: { parts: { text: string }[] } }[] };
  return capForCrutches(JSON.parse(data.candidates[0].content.parts[0].text) as JudgeResult);
}

/** Enforce the crutch-density cap in code, so it holds even if the model doesn't. */
export function capForCrutches(r: JudgeResult): JudgeResult {
  const n = r.ai_crutches?.length ?? 0;
  const cap = n >= 5 ? 4 : n >= 3 ? 6 : 10;
  if (r.score <= cap) return r;
  return { ...r, score: cap, would_a_human_type_this: cap <= 4 ? false : r.would_a_human_type_this };
}
