import {ApiContractError} from '../runtime-validation';
import {cadenceLabel, hasTarget, localDate, numberWord, parseRhythm, trackedWeeks, weeksAtPace} from './rhythm.model';

describe('rhythm API validation', () => {
  const week = (weekStart: string, daysMet: number, met: boolean, frozen = false) => ({
    weekStart,
    daysMet,
    met,
    frozen,
    days: [{date: `${weekStart}`, minutes: 25, met: daysMet > 0}],
  });
  const language = (code: string, target: number | null, editable = true, startedAt = '2026-01-05') => ({
    language: code,
    target,
    editable,
    startedAt,
    setAsideAt: null,
    weeks: [week('2026-01-05', 2, false), week('2026-01-12', 2, true), week('2026-02-16', 2, target === 2)],
  });

  it('parses the backend rhythm contract', () => {
    const rhythm = parseRhythm({languages: [language('DE', 2)]});

    expect(rhythm.languages[0].target).toBe(2);
    expect(rhythm.languages[0].startedAt).toBe('2026-01-05');
    expect(rhythm.languages[0].weeks[2].met).toBeTrue();
    expect(rhythm.languages[0].weeks[0].days[0].minutes).toBe(25);
  });

  it('keeps each language its own bar', () => {
    const rhythm = parseRhythm({languages: [language('DE', 2), language('ES', 4)]});

    expect(rhythm.languages.map(entry => entry.language)).toEqual(['DE', 'ES'] as never);
    expect(rhythm.languages[1].target).toBe(4);
  });

  it('accepts a learner who has never chosen a target', () => {
    expect(parseRhythm({languages: [language('DE', null)]}).languages[0].target).toBeNull();
  });

  it('carries the read-only flag of a set-aside language', () => {
    expect(parseRhythm({languages: [language('DE', 2, false)]}).languages[0].editable).toBeFalse();
  });

  it('rejects a week without its verdict', () => {
    expect(() => parseRhythm({
      languages: [{
        language: 'DE', target: 2, editable: true, startedAt: '2026-01-05', setAsideAt: null,
        weeks: [{weekStart: '2026-02-16', daysMet: 1, frozen: false, days: []}],
      }],
    })).toThrowError(ApiContractError);
  });

  it('counts only the weeks a language has existed, so a new one is not judged against fourteen', () => {
    const rhythm = parseRhythm({languages: [language('DE', 2, true, '2026-01-12')]});

    expect(trackedWeeks(rhythm.languages[0]).length).toBe(2);
    expect(weeksAtPace(rhythm.languages[0])).toBe(2);
  });

  it('leaves a frozen week out of the count, so a set-aside language cannot accumulate misses', () => {
    const parsed = parseRhythm({
      languages: [{
        language: 'DE', target: 2, editable: false, startedAt: '2026-01-05', setAsideAt: '2026-01-19',
        weeks: [week('2026-01-05', 2, true), week('2026-01-12', 2, true), week('2026-01-19', 0, false, true)],
      }],
    });

    expect(trackedWeeks(parsed.languages[0]).length).toBe(2);
    expect(weeksAtPace(parsed.languages[0])).toBe(2);
  });

  it('names the cadence the way the card reads it', () => {
    expect(cadenceLabel(1)).toBe('Once a week');
    expect(cadenceLabel(2)).toBe('Twice a week');
    expect(cadenceLabel(4)).toBe('Four times a week');
    expect(cadenceLabel(0)).toBe('No target');
  });

  it('spells the record out in words, because it is a sentence about a person', () => {
    expect(numberWord(11)).toBe('Eleven');
    expect(numberWord(0)).toBe('No');
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
