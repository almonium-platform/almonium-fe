import {ApiContractError} from '../runtime-validation';
import {hasTarget, localDate, parseRhythm} from './rhythm.model';

describe('rhythm API validation', () => {
  const week = (weekStart: string, daysMet: number, met: boolean) => ({
    weekStart,
    daysMet,
    met,
    days: [{date: `${weekStart}`, minutes: 25, met: daysMet > 0}],
  });

  it('parses the backend rhythm contract', () => {
    const rhythm = parseRhythm({target: 3, weeks: [week('2026-02-16', 3, true)]});

    expect(rhythm.target).toBe(3);
    expect(rhythm.weeks[0].met).toBeTrue();
    expect(rhythm.weeks[0].days[0].minutes).toBe(25);
  });

  it('accepts a learner who has never chosen a target', () => {
    expect(parseRhythm({target: null, weeks: []}).target).toBeNull();
  });

  it('rejects a week without its verdict', () => {
    expect(() => parseRhythm({target: 3, weeks: [{weekStart: '2026-02-16', daysMet: 1, days: []}]}))
      .toThrowError(ApiContractError);
  });

  it('treats an explicit no-target as a choice rather than a bar', () => {
    expect(hasTarget(0)).toBeFalse();
    expect(hasTarget(null)).toBeFalse();
    expect(hasTarget(2)).toBeTrue();
  });

  it('reports the day in the learner own calendar, not UTC', () => {
    expect(localDate(new Date(2026, 1, 3, 23, 30))).toBe('2026-02-03');
  });
});
