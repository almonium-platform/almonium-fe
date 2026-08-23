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

  it('preserves optional metadata used by the home vocabulary summary', () => {
    const [card] = parseCards([{
      id: 'card-1',
      entry: 'verlassen',
      language: 'DE',
      translations: [{id: 'translation-1', translation: 'to leave'}],
      tags: [{text: 'verb'}],
      examples: [{id: 'example-1', example: 'Er hat das Zimmer verlassen.', translation: 'He left the room.'}],
      createdAt: '2026-08-23T12:00:00Z',
      iteration: 3,
      activeLearning: true,
      falseFriend: false,
    }]);

    expect(card).toEqual(jasmine.objectContaining({
      id: 'card-1',
      createdAt: '2026-08-23T12:00:00Z',
      iteration: 3,
      activeLearning: true,
      falseFriend: false,
      tags: [{text: 'verb'}],
      examples: [{id: 'example-1', example: 'Er hat das Zimmer verlassen.', translation: 'He left the room.'}],
    }));
  });
});
