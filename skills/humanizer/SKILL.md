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

## Optional deeper layers

- **`--judge`** adds a Gemini rubric read (rhythm, voice, effort asymmetry) with quoted worst lines and rewrites. Needs `GEMINI_API_KEY` in the environment; skip it if unset. Calibrate to a voice by putting human-written samples in the plugin's `exemplars/` dir.
- **`detector/`** is a supervised DeBERTa second opinion (Python; see `detector/DETECTORS.md`).

## One caveat, always honor it

These signals grade the user's OWN drafts. Predictability detectors false-positive on non-native English and idiosyncratic human writing — never use this to accuse someone else of using AI. Frame every result as "here's what reads mechanically, want to loosen it?"
