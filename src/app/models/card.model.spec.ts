import {ApiContractError} from '../shared/runtime-validation';
import {parseCards} from './card.model';

describe('card API validation', () => {
  it('parses the card fields required by the review flow', () => {
    expect(parseCards([{
      entry: 'bonjour',
      language: 'FR',
      translations: [{id: 'translation-1', translation: 'hello'}],
    }])).toEqual([{
      entry: 'bonjour',
      language: 'FR',
      translations: [{id: 'translation-1', translation: 'hello'}],
    }]);
  });

  it('rejects a malformed card response instead of rendering it as an empty review list', () => {
    expect(() => parseCards([{entry: 'bonjour', language: 'FR', translations: [{}]}]))
      .toThrowError(ApiContractError);
  });
});
