import { describe, expect, it } from 'vitest';
import { scoreText } from '../src/tone-grader.ts';

// A paragraph dense with formal-AI tells: AI vocab, hedges, tricolon, "not X but
// Y", em-dash chains, uniform cadence.
const AI_SLOP = `It's worth noting that this robust, seamless framework serves as a testament to modern engineering. We don't just build software — we craft experiences, foster communities, and unlock potential. Fundamentally, the intricate tapestry of the ever-evolving landscape underscores a crucial truth. It is not just a tool, but a paradigm. Ultimately, this pivotal shift will elevate and empower teams everywhere.`;

// A terse human dev note: contractions, varied lengths, no tells.
const HUMAN = `okay so the deploy broke again lol. turned out the env var was just missing on prod. copy pasted it from staging and it worked. 3.5x faster now too which is wild. anyway shipping it.`;

describe('scoreText', () => {
  it('scores obvious AI slop high and flags the tells', () => {
    const m = scoreText(AI_SLOP);
    expect(m.aiScore).toBeGreaterThan(40);
    expect(m.aiVocab).toBeGreaterThan(3);
    expect(m.hedges).toBeGreaterThanOrEqual(1);
    expect(m.negParallel).toBeGreaterThanOrEqual(1);
  });

  it('scores a terse human note low', () => {
    const m = scoreText(HUMAN);
    expect(m.aiScore).toBeLessThan(15);
  });

  it('ranks AI slop well above the human note', () => {
    expect(scoreText(AI_SLOP).aiScore).toBeGreaterThan(scoreText(HUMAN).aiScore + 30);
  });

  it('counts em-dash density per 1k words', () => {
    expect(scoreText('a — b — c — d').emDashPer1k).toBeGreaterThan(0);
    expect(scoreText('plain prose with no dashes at all here').emDashPer1k).toBe(0);
  });

  it('is stable on empty input (no divide-by-zero)', () => {
    const m = scoreText('');
    expect(Number.isFinite(m.aiScore)).toBe(true);
    expect(m.aiScore).toBe(0);
  });
});
