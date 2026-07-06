# humanizer

Score how much a piece of writing reads like AI — and see exactly which tells give
it away. A deterministic scorer (instant, zero-dependency), an optional LLM judge,
and an optional supervised detector. Each fails differently, so agreement is the
signal.

Built for **self-editing your own drafts**, not for accusing anyone else's — see
[the caveat](#detectors-are-advisory) below.

## Use it in Claude Code

This repo is also a Claude Code plugin marketplace. Add it and install the plugin:

```
/plugin marketplace add chadfurman/humanizer
/plugin install humanizer@humanizer
```

That gives Claude a `humanizer` skill — ask it to "check this draft for AI tells" or
"score these posts and rank them," and it runs the scorer against your files and
offers to rewrite what fires. No install step; it runs on Node ≥ 22.6's native
TypeScript support.

## Quick start

```bash
npm install
npm run humanize -- draft.md         # score a file
npm run humanize < draft.txt         # score stdin
npm run humanize -- draft.md --json  # machine-readable
```

No-install alternative (Node ≥ 22.6, native TypeScript):

```bash
node --experimental-transform-types src/cli.ts draft.md
```

```
draft.md  aiScore 61/100
  em-dash/1k 8.2  tricolons 2  ai-vocab 7  hedges 1  quips 0  burstiness 3.1  contractions/100 0.0
  tells: emDash(3), tricolon(2), hedges(1), aiVocab(7), negParallel(1)
```

Lower is more human. As a rough self-edit gate, aim for **aiScore ≤ 15**.

## Use it as a library

```ts
import { scoreText } from 'humanizer';

const { aiScore, hits } = scoreText(myDraft);
```

## The three layers

| Layer | What it catches | Cost |
|-------|-----------------|------|
| `src/tone-grader.ts` | Countable tells: AI vocab, quip-tics, tricolons, em-dash density, adverb inflation, stiff/uncontracted texture, low burstiness | instant, zero-dep |
| `src/judge.ts` | What counting can't: uniform rhythm, hollow enthusiasm, view-from-nowhere voice, tidy-moral endings | one Gemini call |
| `detector/detector.py` | A supervised DeBERTa second opinion that fails differently | model download |

### LLM judge

```bash
export GEMINI_API_KEY=...
npx tsx src/cli.ts draft.md --judge
```

Calibrate it to a voice by dropping 1–3 human-written samples in `exemplars/`
(git-ignored — they stay local). See [`exemplars/README.md`](exemplars/README.md).

### Supervised detector

See [`detector/DETECTORS.md`](detector/DETECTORS.md) for setup and calibration.

## What the score measures

The grader weights a cluster of signals — no single one is conclusive. Formal-AI
tells (`delve`, `robust`, `seamless`, "not just X but Y", em-dash chains, rule-of-
three), punchy-AI tells (internet quips), adverb inflation, and texture measured
against a human-writing baseline (contractions per 100 words, sentence-opener
diversity, sentence-length burstiness). `hits` lists every phrase it matched, so you
can go fix them.

## Detectors are advisory

Predictability-based detectors measure how *uniform* prose is, not who wrote it.
Liang et al. 2023 found a 61% false-positive rate on non-native English essays. For
grading your **own** drafts that's fine — read a high score as "this reads
predictably" and tighten it. It makes these tools unfit to judge other people's
writing. Don't use them that way.

## Test

```bash
npm test
```

## License

MIT © Chad Furman
