import {LanguageCode} from '../../models/language.enum';
import {ApiContractError} from '../../shared/runtime-validation';
import {CEFRLevel} from '../../models/userinfo.model';
import {parseBook, parseBookMiniDetails, parseBookshelfView} from './book.model';

describe('book API runtime validation', () => {
  const book = {
    id: '01989f47-4c2a-7a10-9e5b-751983624a25',
    title: 'The Book',
    author: 'An Author',
    publicationYear: 2026,
    coverImageUrl: '/cover.jpg',
    wordCount: 1000,
    rating: 4.5,
    language: LanguageCode.EN,
    levelFrom: CEFRLevel.A1,
    levelTo: CEFRLevel.B1,
    progressPercentage: null,
    isTranslation: false,
    hasParallelTranslation: false,
    hasTranslation: false,
  };

  it('normalizes bookshelf summaries that omit detail-only fields', () => {
    const view = parseBookshelfView({
      continueReading: [book],
      available: [],
      favorites: [],
    });

    expect(view.continueReading[0].description).toBe('');
    expect(view.continueReading[0].languageVariants).toEqual([]);
    expect(view.continueReading[0].favorite).toBeFalse();
  });

  it('rejects an unknown language before it reaches reader state', () => {
    expect(() => parseBook({...book, language: 'INVALID'})).toThrowError(ApiContractError);
  });

  it('rejects numeric book identifiers', () => {
    expect(() => parseBook({...book, id: 1})).toThrowError(ApiContractError);
  });

  it('rejects malformed mini-details arrays', () => {
    expect(() => parseBookMiniDetails({
      progressPercentage: 20,
      language: LanguageCode.EN,
      languageVariants: {},
    })).toThrowError(ApiContractError);
  });
});
