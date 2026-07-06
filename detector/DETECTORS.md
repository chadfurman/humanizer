# Detector layers — research + notes

The stack, cheapest first. Each layer fails differently; agreement is the signal.

1. **`src/tone-grader.ts`** (deterministic, instant, zero-dep) — counts tells:
   formal-AI lexicon, quip-tics, adverb inflation, tricolons, em-dash density,
   and corpus-relative texture (contractions/100w, sentence-opener diversity,
   burstiness). Suggested self-edit gate: `aiScore ≤ 15` (a human writing corpus
   sits around 2; lightly-edited human posts land 0–12).
2. **`src/judge.ts`** (Gemini 2.5 Flash, temp 0) — rubric-scored on rhythm, tics
   (incl. view-from-nowhere voice + fake hedging), specificity, voice, and effort
   asymmetry. Quotes the worst lines with rewrites. Calibrate it to your own voice
   by dropping human-written samples in `exemplars/`.
3. **`detector/detector.py`** — `desklib/ai-text-detector-v1.01`, a supervised
   DeBERTa classifier. Calibration seen in practice: a human writing corpus ≈ 0.03,
   deliberate AI slop ≈ 1.00, lightly-edited human prose ≈ 0.25–0.37. Reports the
   mean + worst 500-word chunk. **Advisory canary, never a gate** — it flags chunks
   the other layers pass.

### Why detectors are advisory, not gates

Perplexity- and predictability-based detectors measure prose UNIFORMITY, not
authorship. Liang et al. 2023 (arXiv 2304.02819) found a 61% false-positive rate on
non-native English (TOEFL) essays. For *self*-grading your own drafts that's fine —
read a high score as "this prose is predictable," not "a machine wrote this" — but it
makes them unfit to judge anyone else's writing. Don't point this at other people.

### Running the detector

```bash
cd detector
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python detector.py ../path/to/draft.md
```

First run downloads the model (~700MB). Uses Apple MPS if available, else CPU.

### Deliberately skipped

Fast-DetectGPT (needs GPT-Neo-2.7B, ~5GB), Binoculars (two 7B models), and the
commercial APIs (GPTZero / Sapling / Originality — none free at per-draft volume).

Sources: huggingface.co/desklib/ai-text-detector-v1.01 ·
github.com/baoguangsheng/fast-detect-gpt · github.com/liamdugan/raid ·
arxiv.org/abs/2304.02819
