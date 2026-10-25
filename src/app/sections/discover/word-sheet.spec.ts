import {CEFRLevel} from '../../models/userinfo.model';
import {DiscoverSense} from './discover.service';
import {exampleParts, frequencyBars, groupSenses, hiddenCounts, leadsWithDefinition, readingLabels, toGroups} from './word-sheet';

describe('word sheet', () => {
  const sense = (index: number, partOfSpeech: string): DiscoverSense =>
    ({index, headword: 'clear', partOfSpeech, transcription: null, translations: [], definition: null, cefr: null, examples: []});

  it('gathers each part of speech where its first sense stands and numbers across the groups', () => {
    const rows = groupSenses([sense(1, 'ADJ'), sense(2, 'VERB'), sense(3, 'ADJ')]);
    expect(rows.map(row => [row.number, row.sense.index])).toEqual([[1, 1], [2, 3], [3, 2]]);
    expect(toGroups(rows).map(group => group.partOfSpeech)).toEqual(['ADJ', 'VERB']);
    expect(hiddenCounts(rows.slice(1))).toEqual([{partOfSpeech: 'ADJ', count: 1}, {partOfSpeech: 'VERB', count: 1}]);
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

  describe('reading labels', () => {
    const label = (partOfSpeech: string | null) => partOfSpeech?.toLowerCase() ?? '';

    it('names none when every reading is said for the same senses (niche)', () => {
      const rows = groupSenses([sense(1, 'NOUN'), sense(2, 'ADJ')]);
      expect(readingLabels([[1, 2], [2, 1]], rows, label)).toBeNull();
      expect(readingLabels([[1, 2]], rows, label)).toBeNull();
    });

    it('names each reading by the parts of speech of its senses (live, research)', () => {
      const rows = groupSenses([sense(1, 'ADJ'), sense(2, 'ADV'), sense(3, 'VERB')]);
      expect(readingLabels([[1, 2], [3]], rows, label)).toEqual(['adj, adv', 'verb']);
      expect(readingLabels([[1, 3], [1]], groupSenses([sense(1, 'NOUN'), sense(2, 'X'), sense(3, 'VERB')]), label)).toEqual(['noun, verb', 'noun']);
    });

    it('adds the sense numbers where the parts of speech leave two readings alike (bow)', () => {
      const rows = groupSenses([sense(1, 'NOUN'), sense(2, 'VERB'), sense(3, 'NOUN')]);
      expect(readingLabels([[1], [2], [3]], rows, label)).toEqual(['noun (1)', 'verb', 'noun (2)']);
    });
  });
});
