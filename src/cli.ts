#!/usr/bin/env -S npx tsx
// humanizer — score how much text reads like AI, and see the tells.
//   npx tsx src/cli.ts <file.md ...>     score files (markdown frontmatter stripped)
//   cat draft.txt | npx tsx src/cli.ts   score stdin
//   --json                                machine-readable output
//   --judge                               also run the Gemini LLM judge (needs GEMINI_API_KEY)

import { readFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { scoreText, type ToneMetrics } from './tone-grader.ts';
import { judgeText, loadExemplars } from './judge.ts';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const files = args.filter((a) => !a.startsWith('--'));

function stripFrontmatter(md: string): string {
  const m = md.match(/^---\n[\s\S]*?\n---\n?/);
  return (m ? md.slice(m[0].length) : md).trim();
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
  });
}

function topTells(m: ToneMetrics): string {
  const tells = Object.entries(m.hits).filter(([, v]) => v.length).map(([k, v]) => `${k}(${v.length})`);
  return tells.length ? tells.join(', ') : 'none';
}

function printHuman(label: string, m: ToneMetrics): void {
  console.log(`\n${label}  aiScore ${m.aiScore}/100`);
  console.log(
    `  em-dash/1k ${m.emDashPer1k}  tricolons ${m.tricolons}  ai-vocab ${m.aiVocab}  hedges ${m.hedges}  ` +
      `quips ${m.quips}  burstiness ${m.burstiness}  contractions/100 ${m.contractionsPer100}`,
  );
  console.log(`  tells: ${topTells(m)}`);
}

async function main(): Promise<void> {
  const inputs: { label: string; body: string }[] = [];
  if (files.length) {
    for (const f of files) inputs.push({ label: basename(f), body: stripFrontmatter(readFileSync(f, 'utf8')) });
  } else {
    inputs.push({ label: 'stdin', body: stripFrontmatter(await readStdin()) });
  }

  const scored = inputs.map((i) => ({ ...i, m: scoreText(i.body) }));

  if (flags.has('--json') && !flags.has('--judge')) {
    console.log(JSON.stringify(scored.map(({ label, m }) => ({ label, ...m })), null, 2));
    return;
  }

  for (const { label, m } of scored) printHuman(label, m);

  if (flags.has('--judge')) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.error('\n--judge needs GEMINI_API_KEY in the environment.');
      process.exit(1);
    }
    const exemplars = loadExemplars(join(process.cwd(), 'exemplars'));
    for (const { label, body } of scored) {
      const j = await judgeText(body, key, exemplars);
      console.log(`\njudge · ${label}: ${j.score}/10 human — ${j.would_a_human_type_this ? 'passes' : 'FAILS'} would-a-human-type-this`);
      console.log(`  ${j.verdict}`);
      console.log(`  authenticity ${j.authenticity}/10 — ${j.authenticity_notes}`);
      console.log(`  emotion & impact ${j.emotion_impact}/10 — ${j.emotion_impact_notes}`);
      if (j.ai_crutches.length) console.log(`  ai crutches: ${j.ai_crutches.map((c) => `"${c}"`).join('; ')}`);
      for (const w of j.worst_lines) console.log(`  ✗ "${w.quote}" — ${w.why}\n     → ${w.rewrite}`);
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
