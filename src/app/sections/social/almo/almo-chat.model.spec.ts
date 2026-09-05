import {almoMarksOf, parseAlmoChats, parseAlmoReply} from './almo-chat.model';

describe('almo chat model', () => {
  it('parses the channels the server hands over', () => {
    const chats = parseAlmoChats([
      {
        cid: 'private:almo_1_de',
        language: 'DE',
        name: 'Almo · Deutsch',
        placeholder: 'Schreib auf Deutsch',
        openers: [{text: 'Ein Satz mit dennoch', word: 'dennoch'}, {text: 'Frag mich meine Wörter ab', word: null}],
      },
    ]);

    expect(chats).toEqual([
      {
        cid: 'private:almo_1_de',
        language: 'DE',
        name: 'Almo · Deutsch',
        placeholder: 'Schreib auf Deutsch',
        openers: [{text: 'Ein Satz mit dennoch', word: 'dennoch'}, {text: 'Frag mich meine Wörter ab', word: null}],
      },
    ]);
  });

  it('refuses a channel without a cid', () => {
    expect(() => parseAlmoChats([{language: 'DE', name: 'x', placeholder: 'y', openers: []}])).toThrow();
  });

  it('reads a reply outcome, with the ceiling defaulting to not reached', () => {
    expect(parseAlmoReply({replyMessageId: 'r1'})).toEqual({replyMessageId: 'r1', ceilingReached: false});
    expect(parseAlmoReply({replyMessageId: null, ceilingReached: true})).toEqual({replyMessageId: null, ceilingReached: true});
  });

  it('reads his marks off a message and treats a message without them as ordinary', () => {
    expect(almoMarksOf({text: 'x', almoWords: ['dabei', 3, ''], almoContrast: ['a', 'b'], almoTranslation: 'Well?'}))
      .toEqual({words: ['dabei'], contrast: ['a', 'b'], translation: 'Well?'});
    expect(almoMarksOf({text: 'x'})).toBeNull();
    expect(almoMarksOf({text: 'x', almoTranslation: '   '})).toBeNull();
    expect(almoMarksOf(undefined)).toBeNull();
  });
});
