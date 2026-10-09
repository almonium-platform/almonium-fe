import {copyrightCountdown, daysUntilNewYear, freeSinceNote, nextPublicDomainYear} from './public-domain-day';

describe('public domain day', () => {
  const day = (year: number, month: number, date: number, hour = 12) => new Date(year, month - 1, date, hour);

  describe('daysUntilNewYear', () => {
    it('counts calendar days to 1 January, whatever the hour', () => {
      expect(daysUntilNewYear(2027, day(2026, 10, 9, 0))).toBe(84);
      expect(daysUntilNewYear(2027, day(2026, 10, 9, 23))).toBe(84);
      expect(daysUntilNewYear(2027, day(2026, 12, 31))).toBe(1);
      expect(daysUntilNewYear(2027, day(2027, 1, 1))).toBe(0);
    });

    it('is not thrown off by a clock change on the way', () => {
      // Late March and late October both cross a daylight-saving change in most of Europe.
      expect(daysUntilNewYear(2027, day(2026, 3, 1))).toBe(306);
    });
  });

  describe('copyrightCountdown', () => {
    const today = day(2026, 10, 9);

    it('counts down in days when the work is free next 1 January', () => {
      expect(copyrightCountdown(2027, today)).toEqual({kind: 'countdown', year: 2027, days: 84});
    });

    it('names the date and the years when it is later', () => {
      expect(copyrightCountdown(2047, today)).toEqual({kind: 'later', year: 2047, years: 21});
      expect(copyrightCountdown(2028, today)).toEqual({kind: 'later', year: 2028, years: 2});
    });

    it('says nothing when the year is unknown or already here', () => {
      expect(copyrightCountdown(null, today)).toBeNull();
      expect(copyrightCountdown(2026, today)).toBeNull();
      expect(copyrightCountdown(1990, today)).toBeNull();
    });

    it('turns over with the reader’s calendar', () => {
      expect(copyrightCountdown(2027, day(2027, 1, 1))).toBeNull();
      expect(copyrightCountdown(2028, day(2027, 1, 1))).toEqual({kind: 'countdown', year: 2028, days: 365});
    });
  });

  describe('freeSinceNote', () => {
    it('notes only this year’s 1 January', () => {
      expect(freeSinceNote(2026, day(2026, 10, 9))).toEqual({kind: 'freeSince', year: 2026});
      expect(freeSinceNote(2025, day(2026, 10, 9))).toBeNull();
      expect(freeSinceNote(null, day(2026, 10, 9))).toBeNull();
    });
  });

  it('counts the shelf down to next 1 January', () => {
    expect(nextPublicDomainYear(day(2026, 10, 9))).toBe(2027);
    expect(nextPublicDomainYear(day(2026, 12, 31, 23))).toBe(2027);
  });
});
