import {ApiContractError} from '../runtime-validation';
import {cadenceLabel, hasTarget, localDate, parseRhythm, trackedWeeks, weeksAtPace} from './rhythm.model';

describe('rhythm API validation', () => {
  const week = (weekStart: string, daysMet: number, met: boolean) => ({
    weekStart,
    daysMet,
    met,
    days: [{date: `${weekStart}`, minutes: 25, met: daysMet > 0}],
  });
  const language = (code: string, target: number | null, editable = true, startedAt = '2026-01-05') => ({
    language: code,
    target,
    editable,
    startedAt,
    weeks: [week('2026-01-05', 3, false), week('2026-01-12', 3, true), week('2026-02-16', 3, target === 3)],
  });

  it('parses the backend rhythm contract', () => {
    const rhythm = parseRhythm({languages: [language('DE', 3)]});

    expect(rhythm.languages[0].target).toBe(3);
    expect(rhythm.languages[0].startedAt).toBe('2026-01-05');
    expect(rhythm.languages[0].weeks[2].met).toBeTrue();
    expect(rhythm.languages[0].weeks[0].days[0].minutes).toBe(25);
  });

  it('keeps each language its own bar', () => {
    const rhythm = parseRhythm({languages: [language('DE', 3), language('ES', 5)]});

    expect(rhythm.languages.map(entry => entry.language)).toEqual(['DE', 'ES'] as never);
    expect(rhythm.languages[1].target).toBe(5);
  });

  it('accepts a learner who has never chosen a target', () => {
    expect(parseRhythm({languages: [language('DE', null)]}).languages[0].target).toBeNull();
  });

  it('carries the read-only flag of a set-aside language', () => {
    expect(parseRhythm({languages: [language('DE', 3, false)]}).languages[0].editable).toBeFalse();
  });

  it('rejects a week without its verdict', () => {
    expect(() => parseRhythm({
      languages: [{
        language: 'DE', target: 3, editable: true, startedAt: '2026-01-05',
        weeks: [{weekStart: '2026-02-16', daysMet: 1, days: []}],
      }],
    })).toThrowError(ApiContractError);
  });

  it('counts only the weeks a language has existed, so a new one is not judged against fourteen', () => {
    const rhythm = parseRhythm({languages: [language('DE', 3, true, '2026-01-12')]});

    expect(trackedWeeks(rhythm.languages[0]).length).toBe(2);
    expect(weeksAtPace(rhythm.languages[0])).toBe(2);
  });

  it('names the cadence the way the row reads it', () => {
    expect(cadenceLabel(3)).toBe('3× a week');
    expect(cadenceLabel(7)).toBe('Daily');
    expect(cadenceLabel(0)).toBe('No target');
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
