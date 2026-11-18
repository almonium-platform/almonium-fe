import {CEFRLevel} from '../../models/userinfo.model';
import {DiscoverSense, NO_ENTRY} from './discover.service';
import {exampleParts, frequencyBars, groupSenses, hiddenCounts, leadsWithDefinition, toGroups} from './word-sheet';

describe('word sheet', () => {
  const sense = (index: number, partOfSpeech: string): DiscoverSense =>
    ({index, key: null, headword: 'clear', partOfSpeech, transcription: null, translations: [], definition: null, cefr: null, examples: [], ...NO_ENTRY});

  it('gathers each part of speech where its first sense stands and numbers across the groups', () => {
    const rows = groupSenses([sense(1, 'ADJ'), sense(2, 'VERB'), sense(3, 'ADJ')]);
    expect(rows.map(row => [row.number, row.sense.index])).toEqual([[1, 1], [2, 3], [3, 2]]);
    expect(toGroups(rows).map(group => group.partOfSpeech)).toEqual(['ADJ', 'VERB']);
    expect(hiddenCounts(rows.slice(1))).toEqual([{partOfSpeech: 'ADJ', count: 1}, {partOfSpeech: 'VERB', count: 1}]);
  });

  it('keeps two words of one part of speech apart when the lexicon says which sense is whose', () => {
    const rows = groupSenses([{...sense(1, 'NOUN'), lexeme: 1}, {...sense(2, 'NOUN'), lexeme: 2}, {...sense(3, 'NOUN'), lexeme: 2}]);
    expect(toGroups(rows).map(group => [group.lexeme, group.rows.length])).toEqual([[1, 1], [2, 2]]);
    expect(hiddenCounts(rows)).toEqual([{partOfSpeech: 'NOUN', count: 3}]);
  });

  it('leads with the translation at A1 and A2 and with the definition from B1 under Match my level', () => {
    expect(leadsWithDefinition('level', CEFRLevel.A2)).toBeFalse();
    expect(leadsWithDefinition('level', CEFRLevel.B1)).toBeTrue();
    expect(leadsWithDefinition('level', null)).toBeFalse();
    expect(leadsWithDefinition('definition', CEFRLevel.A1)).toBeTrue();
    expect(leadsWithDefinition('translation', CEFRLevel.C2)).toBeFalse();
  });

  it('fills one bar per fifth of the score, never none', () => {
    expect([0, 20, 21, 67, 100].map(frequencyBars)).toEqual([1, 1, 2, 4, 5]);
  });

  it('sets the headword apart in its example, inflected or capitalised', () => {
    expect(exampleParts('Clearly, it was clear.', 'clear')).toEqual({text: 'Clearly, it was clear.', before: '', word: 'Clearly', after: ', it was clear.'});
    expect(exampleParts('Nothing here.', 'clear')?.word).toBe('');
    expect(exampleParts(null, 'clear')).toBeNull();
  });

});
