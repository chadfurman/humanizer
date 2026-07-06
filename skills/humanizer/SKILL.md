---
name: humanizer
description: Use when the user wants to check whether writing reads like AI — a file, a draft, a blog post, or pasted text. Scores prose for AI tells (AI vocab, em-dash density, tricolons, quip-tics, stiff texture, uniform rhythm), reports which tells fire, and helps rewrite them out. Also runs an optional LLM judge. Triggers: "does this sound AI", "humanize this", "check my draft for AI tells", "score this writing".
---

# humanizer

Grade how much a piece of writing reads like AI, then help fix it.

## Run it

Zero-install on Node ≥ 22.6 (uses native TypeScript stripping):

```bash
node --experimental-transform-types "$CLAUDE_PLUGIN_ROOT/src/cli.ts" <file>...
```

If Node is older, fall back to `npx tsx "$CLAUDE_PLUGIN_ROOT/src/cli.ts" <file>...`.

- **Files:** pass one or more paths. Markdown frontmatter is stripped automatically.
- **Pasted text / a draft in the chat:** pipe it in — `printf '%s' "<text>" | node --experimental-transform-types "$CLAUDE_PLUGIN_ROOT/src/cli.ts"`. Avoid a raw heredoc if the text has quotes.
- **`--json`** for machine-readable output when you want to sort or threshold many files.

## Read the result

```
draft.md  aiScore 61/100
  em-dash/1k 8.2  tricolons 2  ai-vocab 7  hedges 1  quips 0  burstiness 3.1  contractions/100 0.0
  tells: emDash(3), tricolon(2), hedges(1), aiVocab(7), negParallel(1)
```

- **aiScore** is 0–100, higher = more AI. As a rough gate, **≤ 15 reads human**; 15–35 is edit-worthy; above that it's obvious.
- **tells** names each firing signal with a count. That's your fix list — the `--json` output's `hits` field quotes the exact phrases.
- No single signal is proof; it's the cluster. Low **burstiness** (uniform sentence lengths) and low **contractions/100** on longer text are the subtle ones.

After scoring, offer to rewrite the flagged lines: vary sentence length, cut the AI vocab and tricolons, drop hollow hedges, add real specifics. Re-score to confirm the number dropped.

## Go past "is it AI" — measure what makes writing human

The static grader only counts AI *tells*. Add **`--judge`** (Gemini; needs `GEMINI_API_KEY`, skip if unset) to score the POSITIVE human qualities the counter can't see. It returns, each 0–10 with quoted evidence:

- **authenticity** — lived experience (named places, sensory detail, real memories, a real identity behind the words), creative messiness (tangents, asides, unresolved threads vs tidy formula), critical thinking (a real/contrarian take vs view-from-nowhere), and whether it trusts the reader instead of over-explaining.
- **emotion & impact** — does it actually make you feel anything or leave an impression? Stakes, vulnerability, a line that lands — vs competent-but-dead prose and motivational-poster endings.
- **ai_crutches** — the specific structural tics quoted back ("It's not X, it's Y", em-dash chains, rule-of-three, tidy-moral endings).

Always report BOTH: the static aiScore (the tells) *and* the judge's authenticity + emotion/impact (the substance). A draft can score low-AI yet still be hollow — flag that.

```bash
node --experimental-transform-types "$CLAUDE_PLUGIN_ROOT/src/cli.ts" draft.md --judge
```

Calibrate the judge to a specific voice by putting human-written samples in the plugin's `exemplars/` dir.

## Coach toward human, don't just grade

After scoring, help the writer close the gap — concretely, tied to what they're working on:

- Replace generalities with **lived specifics**: a real place, a real number, a sensory detail, something that actually happened.
- Let it be **messy**: keep a tangent, an aside, an unresolved thought. Vary sentence length hard.
- State a **real opinion with stakes** — cut the balanced view-from-nowhere.
- **Trust the reader**: delete the "It's not X, it's Y" crutches, the tidy moral, the signposting.
- Re-score to confirm authenticity and emotion went UP, not just that aiScore went down.

If they want to retrain their own voice rather than patch a draft, ask what they're writing (fiction / essay / blog / academic) and whether they want AI-free drafting habits — pen and paper, offline editors (Scrivener, Obsidian, FocusWriter), editing against a print style guide — then tailor from there.

## Supervised detector

`detector/` is a supervised DeBERTa second opinion (Python; see `detector/DETECTORS.md`).

## One caveat, always honor it

These signals grade the user's OWN drafts. Predictability detectors false-positive on non-native English and idiosyncratic human writing — never use this to accuse someone else of using AI. Frame every result as "here's what reads mechanically, want to loosen it?"
