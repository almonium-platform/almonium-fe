import {LanguageCode} from '../../../models/language.enum';
import {CEFRLevel} from '../../../models/userinfo.model';
import {ordinal, parseWantReceipt, parseWantedQueue, readersLabel, wantedToastMessage} from './wanted.model';

describe('wanted model', () => {
  it('says the place in line as an English ordinal', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal))
      .toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th']);
  });

  it('words the toast with the rank, and without it when the server could not place the want', () => {
    expect(wantedToastMessage(2)).toBe('Added to Wanted. It’s 2nd in line.');
    expect(wantedToastMessage(1)).toBe('Added to Wanted. It’s 1st in line.');
    expect(wantedToastMessage(0)).toBe('Added to Wanted.');
  });

  it('counts readers only once the server does', () => {
    expect(readersLabel(null)).toBeNull();
    expect(readersLabel(12)).toBe('12 readers');
  });

  it('reads the answer to a want', () => {
    expect(parseWantReceipt({catalogWorkId: 'w1', language: 'FR', rank: 3, readers: null}))
      .toEqual({catalogWorkId: 'w1', language: LanguageCode.FR, rank: 3, readers: null});
    expect(() => parseWantReceipt({catalogWorkId: 'w1', language: 'XX', rank: 3})).toThrowError(/want\.language/);
  });

  it('reads the Wanted page, with nullable authors, slugs, levels and covers', () => {
    const queue = parseWantedQueue({
      beingPrepared: [{catalogWorkId: 'p1', title: 'Emma', author: 'Jane Austen', language: 'DE', workSlug: 'emma', rank: 1, readers: 9, wantedByMe: true, status: 'IN_PROGRESS'}],
      queue: [{catalogWorkId: 'q1', title: 'Untitled', author: null, language: 'FR', workSlug: null, rank: 2, readers: null, wantedByMe: false, status: 'OPEN'}],
      recentlyArrived: [{catalogWorkId: 'a1', title: 'Dracula', author: 'Bram Stoker', language: 'EN', editionSlug: 'dracula-b2-en', cefrLevel: 'B2', coverUrl: null, arrivedAt: '2026-10-01T00:00:00Z'}],
      mineCount: 1,
    });
    expect(queue.beingPrepared[0].workSlug).toBe('emma');
    expect(queue.queue[0].author).toBeNull();
    expect(queue.recentlyArrived[0]).toEqual({
      catalogWorkId: 'a1', title: 'Dracula', author: 'Bram Stoker', language: LanguageCode.EN, editionSlug: 'dracula-b2-en', cefrLevel: CEFRLevel.B2, coverUrl: null,
    });
    expect(queue.mineCount).toBe(1);
    expect(() => parseWantedQueue({beingPrepared: [], queue: [{status: 'DONE'}], recentlyArrived: [], mineCount: 0})).toThrowError(/wanted\.queue\[0\]/);
  });
});
