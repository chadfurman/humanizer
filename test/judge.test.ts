import { describe, expect, it } from 'vitest';
import { capForCrutches, type JudgeResult } from '../src/judge.ts';

const base: JudgeResult = {
  score: 9,
  verdict: 'strong voice',
  authenticity: 9,
  authenticity_notes: 'real specifics',
  emotion_impact: 8,
  emotion_impact_notes: 'lands',
  ai_crutches: [],
  worst_lines: [],
  would_a_human_type_this: true,
};

const withCrutches = (n: number, score = 9): JudgeResult => ({
  ...base,
  score,
  ai_crutches: Array.from({ length: n }, (_, i) => `crutch ${i}`),
});

describe('capForCrutches', () => {
  it('leaves a low-crutch piece alone', () => {
    expect(capForCrutches(withCrutches(2)).score).toBe(9);
  });

  it('caps a voice-y but crutch-heavy piece at 6 (3-4 crutches)', () => {
    expect(capForCrutches(withCrutches(3)).score).toBe(6);
    expect(capForCrutches(withCrutches(4)).score).toBe(6);
  });

  it('caps at 4 and fails the human test at 5+ crutches', () => {
    const r = capForCrutches(withCrutches(7));
    expect(r.score).toBe(4);
    expect(r.would_a_human_type_this).toBe(false);
  });

  it('never RAISES a score that is already below the cap', () => {
    expect(capForCrutches(withCrutches(5, 2)).score).toBe(2);
  });

  it('leaves authenticity untouched — the voice is still real', () => {
    expect(capForCrutches(withCrutches(7)).authenticity).toBe(9);
  });
});
