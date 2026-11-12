import { describe, expect, it } from 'vitest';
import { content } from '../data/load';
import { apply, newRun, type RunState } from '../sim/run';
import { TUTORIAL_SEED, tutorialFinished, tutorialStep } from './tutorial';

const none = new Set<string>();

describe('tutorial coach follows run state', () => {
  it('walks pitch -> place -> adjacent -> phases', () => {
    let s: RunState = newRun(TUTORIAL_SEED, content);
    expect(tutorialStep(s, none)?.id).toBe('pitch');
    s = apply(s, { type: 'startProject', ...s.pitch[0] }, content)[0];
    expect(tutorialStep(s, none)?.id).toBe('place');
    s = apply(s, { type: 'place', dept: 'code', workerId: s.roster[0] }, content)[0];
    expect(tutorialStep(s, none)?.id).toBe('adjacent');
    s = apply(s, { type: 'endPhase' }, content)[0];
    expect(tutorialStep(s, none)?.id).toBe('phases');
    expect(tutorialStep(s, new Set(['phases']))).toBeNull(); // dismissed steps stay dismissed; nothing to say mid-project
    expect(tutorialFinished(new Set(['phases']))).toBe(false); // a quiet coach is not a finished tutorial
  });
  it('an event takes priority whenever one is waiting (on vs off)', () => {
    const s = newRun(TUTORIAL_SEED, content);
    expect(tutorialStep({ ...s, event: content.events[0].id }, none)?.id).toBe('event');
    expect(tutorialStep(s, none)?.id).not.toBe('event');
  });
  it('the fixed seed gives a newcomer a good first review on any pitch', () => {
    const start = newRun(TUTORIAL_SEED, content);
    let s = start;
    for (let pitch = 0; pitch < start.pitch.length; pitch++) {
      let r: RunState = apply(start, { type: 'startProject', ...start.pitch[pitch] }, content)[0];
      while (r.project) {
        for (const d of content.departments) { const w = r.roster.find((id) => !Object.values(r.board).includes(id)); if (w && !r.board[d]) r = apply(r, { type: 'place', dept: d, workerId: w }, content)[0]; }
        r = apply(r, { type: 'endPhase' }, content)[0];
      }
      expect(r.releases[0].review).toBeGreaterThanOrEqual(9);
      if (pitch === 0) s = r;
    }
    expect(tutorialStep(s, none)?.id).toBe('review');
    expect(tutorialStep(s, new Set(['phases', 'review']))?.id).toBe('payroll'); // payroll follows the first review
    expect(tutorialFinished(new Set(['phases', 'review', 'payroll']))).toBe(true);
  });
});
