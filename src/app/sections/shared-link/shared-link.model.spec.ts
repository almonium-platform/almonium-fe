import {parseAddedWordsResult, parseSharedDeckView, parseViewerStatus} from './shared-link.model';

const WORD_ID = '019200a0-0000-7000-8000-000000000001';

describe('shared link model', () => {
  it('parses an active deck with its words and sharer', () => {
    const view = parseSharedDeckView({
      status: 'ACTIVE', shareId: '8fk2qaZZ', title: 'Der Vorleser', language: 'DE',
      words: [{id: WORD_ID, entry: 'verschweigen', partOfSpeech: 'verb', selectedSense: null,
        translations: ['to keep something secret'], examples: [{example: 'Sie hat es verschwiegen.', translation: null}],
        sourceContext: null}],
      sharer: {username: 'kuzanoleg', avatarUrl: null, premium: true},
    });
    expect(view.status).toBe('ACTIVE');
    expect(view.words[0].entry).toBe('verschweigen');
    expect(view.words[0].examples[0].translation).toBeNull();
    expect(view.sharer?.premium).toBeTrue();
  });

  it('keeps a dead link empty whatever else the payload carries', () => {
    const view = parseSharedDeckView({status: 'REVOKED', shareId: null, title: null, language: null, words: [], sharer: null});
    expect(view.status).toBe('REVOKED');
    expect(view.words).toEqual([]);
    expect(view.sharer).toBeNull();
  });

  it('rejects a status it does not know', () => {
    expect(() => parseSharedDeckView({status: 'EXPIRED', words: []})).toThrow();
  });

  it('parses the viewer status and an add result', () => {
    const status = parseViewerStatus({owner: false, hasLearner: true, heldWordIds: [WORD_ID], dueAmongHeld: 1});
    expect(status.heldWordIds).toEqual([WORD_ID]);
    const result = parseAddedWordsResult({added: 3, alreadyHeld: 1, firstDueAt: '2026-09-06T10:00:00Z'});
    expect(result.firstDueAt?.toISOString()).toBe('2026-09-06T10:00:00.000Z');
    expect(parseAddedWordsResult({added: 0, alreadyHeld: 2, firstDueAt: null}).firstDueAt).toBeNull();
  });
});
