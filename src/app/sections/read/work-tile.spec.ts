import {CEFRLevel} from '../../models/userinfo.model';
import {LanguageCode} from '../../models/language.enum';
import {Book} from './book.model';
import {TilePreferences, groupIntoWorks, originalsFirst, pickTileEdition, tileEditionsLabel} from './work-tile';

function edition(overrides: Partial<Book>): Book {
  return {
    id: '01989f47-4c2a-7a10-9e5b-751983624a25',
    editionSlug: 'frankenstein-en-c1',
    workSlug: 'frankenstein',
    title: 'Frankenstein; or, The Modern Prometheus',
    author: 'Mary Shelley',
    description: '',
    publicationYear: 1818,
    coverUrl: null,
    wordCount: 77706,
    language: LanguageCode.EN,
    cefrLevel: CEFRLevel.C1,
    progressPercentage: null,
    currentChapter: null,
    chapterCount: null,
    isTranslation: false,
    hasParallelTranslation: true,
    hasTranslation: true,
    languageVariants: [],
    favorite: false,
    editionType: 'original',
    ...overrides,
  };
}

const original = edition({});
const adapted = edition({id: '01989f47-4c2a-7a10-9e5b-751983624a26', editionSlug: 'frankenstein-en-b2', cefrLevel: CEFRLevel.B2, editionType: 'adaptation'});
const ukrainian = edition({id: '01989f47-4c2a-7a10-9e5b-751983624a27', editionSlug: 'frankenstein-uk-b2', language: LanguageCode.UK, cefrLevel: CEFRLevel.B2, editionType: 'machine_translation', isTranslation: true, title: 'Франкенштейн, або Сучасний Прометей', author: 'Мері Шеллі'});
const other = edition({id: '01989f47-4c2a-7a10-9e5b-751983624a28', editionSlug: 'lisova-pisnya-uk', workSlug: 'lisova-pisnya', language: LanguageCode.UK, cefrLevel: CEFRLevel.C1});

const member: TilePreferences = {levelFilter: null, lastOpenedRank: new Map(), selfLevel: CEFRLevel.B2, guest: false};

describe('work tiles', () => {
  it('shows a work once per language, never once per edition', () => {
    const tiles = groupIntoWorks([original, adapted, ukrainian, other], member);
    expect(tiles.map(tile => tile.key)).toEqual(['frankenstein|EN', 'frankenstein|UK', 'lisova-pisnya|UK']);
    expect(tiles[0].editions.length).toBe(2);
  });

  it('opens the edition at the level filter when one is set', () => {
    expect(pickTileEdition([original, adapted], {...member, levelFilter: CEFRLevel.C1})).toBe(original);
    expect(pickTileEdition([original, adapted], {...member, levelFilter: CEFRLevel.B2})).toBe(adapted);
  });

  it('otherwise opens the edition the reader last opened', () => {
    const lastOpenedRank = new Map([[original.editionSlug, 0], [adapted.editionSlug, 1]]);
    expect(pickTileEdition([original, adapted], {...member, lastOpenedRank})).toBe(original);
  });

  it('otherwise opens the closest level at or below the self-reported level, else the lowest', () => {
    expect(pickTileEdition([original, adapted], member)).toBe(adapted);
    expect(pickTileEdition([original, adapted], {...member, selfLevel: CEFRLevel.C2})).toBe(original);
    expect(pickTileEdition([original, adapted], {...member, selfLevel: CEFRLevel.A2})).toBe(adapted);
    expect(pickTileEdition([original, adapted], {...member, selfLevel: null})).toBe(adapted);
  });

  it('opens the original for a guest, or the lowest level when the shelf language has none', () => {
    const guest: TilePreferences = {levelFilter: null, lastOpenedRank: new Map(), selfLevel: null, guest: true};
    expect(pickTileEdition([adapted, original], guest)).toBe(original);
    const adaptedC1 = edition({...adapted, editionSlug: 'frankenstein-en-c1-adapted', cefrLevel: CEFRLevel.C1});
    expect(pickTileEdition([adaptedC1, adapted], guest)).toBe(adapted);
  });

  it('puts originals before translations when sort keys tie', () => {
    expect([ukrainian, other].sort(originalsFirst)).toEqual([other, ukrainian]);
  });
});

describe('the tile caption', () => {
  it('lists the editions the work actually has, original first, and promises nothing else', () => {
    const original = edition({});
    const adapted = edition({id: '01989f47-4c2a-7a10-9e5b-751983624a26', editionSlug: 'frankenstein-en-b2', cefrLevel: CEFRLevel.B2, editionType: 'adaptation'});
    expect(tileEditionsLabel([adapted, original])).toBe('Original C1 · Adapted B2');
    expect(tileEditionsLabel([original])).toBe('Original C1');
  });
  it('names a translation as one and reads a duplicate level once', () => {
    const translation = edition({id: '01989f47-4c2a-7a10-9e5b-751983624a27', editionSlug: 'frankenstein-uk', language: LanguageCode.UK, isTranslation: true, editionType: 'machine_translation'});
    const again = edition({id: '01989f47-4c2a-7a10-9e5b-751983624a28', editionSlug: 'frankenstein-uk-2', language: LanguageCode.UK, isTranslation: true, editionType: 'human_translation'});
    expect(tileEditionsLabel([translation, again])).toBe('Translation C1');
  });
});


describe('multiple adaptation levels', () => {
  it('preserves every available level and opens the specifically filtered edition', () => {
    const levels = [CEFRLevel.A1, CEFRLevel.A2, CEFRLevel.B1, CEFRLevel.B2, CEFRLevel.C1, CEFRLevel.C2];
    const variants = levels.map(level => edition({id: level, editionSlug: `book-${level}`, cefrLevel: level, editionType: 'adaptation'}));
    expect(tileEditionsLabel(variants)).toBe('Adapted A1 · Adapted A2 · Adapted B1 · Adapted B2 · Adapted C1 · Adapted C2');
    for (const level of levels) {
      expect(pickTileEdition(variants, {...member, levelFilter: level}).editionSlug).toBe(`book-${level}`);
    }
  });
});
