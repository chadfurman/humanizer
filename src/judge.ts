// LLM-as-judge (Gemini, temp 0, rubric-based). The deterministic grader counts
// tells; this catches what counting can't — rhythm sameness, hollow enthusiasm,
// quip-flavor, sentences no tired human would type. Optionally calibrate it with
// your OWN human-written excerpts (see loadExemplars) — style, not content.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RUBRIC = `You are judging whether a piece of writing reads like a human wrote it.
Score 0-10 where 10 = indistinguishable from a busy person's own writing and 0 = obviously AI.
Judge these axes, each with specific quoted evidence:
1. RHYTHM — do sentences vary in length and shape, or march in uniform cadence?
2. TICS — formal-AI tells (delve/robust/seamless, "not just X but Y", em-dash chains, rule-of-three), punchy-AI tells (internet quips: "receipts", "chef's kiss", "no notes", "plot twist", forced wryness), view-from-nowhere voice (claims with no owner), adverb inflation (fundamentally/essentially/ultimately), and fake hedging that concedes nothing.
3. SPECIFICITY — real numbers, real detail vs plausible-sounding generalities.
4. VOICE — flat opinions stated plainly; no hollow enthusiasm; no summarizing itself; endings that just stop rather than swelling into a moral.
5. EFFORT ASYMMETRY — humans over-explain what confused them and skip what bored them; AI allocates evenly (watch for symmetric section lengths and a tidy moral at the end).

Return STRICT JSON: {"score": n, "verdict": "...", "worst_lines": [{"quote": "...", "why": "...", "rewrite": "..."}], "would_a_human_type_this": true/false}
Max 5 worst_lines. Quote exactly.`;

export interface JudgeResult {
  score: number;
  verdict: string;
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
  return `\n\nHuman-written excerpts for calibration (match the STYLE, not the content):\n---\n${bits.join('\n---\n')}`;
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
  return JSON.parse(data.candidates[0].content.parts[0].text) as JudgeResult;
}
