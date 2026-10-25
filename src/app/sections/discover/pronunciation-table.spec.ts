import {DiscoverPronunciation, DiscoverSense} from './discover.service';
import {numberRanges, pronunciationTable} from './pronunciation-table';
import {groupSenses} from './word-sheet';

describe('pronunciation table', () => {
  const sense = (index: number, partOfSpeech: string): DiscoverSense =>
    ({index, headword: 'word', partOfSpeech, transcription: null, translations: [], definition: null, cefr: null, examples: []});
  const said = (variety: string, ipa: string, senses: number[], clipUrl: string | null = null): DiscoverPronunciation =>
    ({variety, ipa, clipUrl, clipStatus: clipUrl ? 'verified' : null, segments: null, senses});
  const label = (partOfSpeech: string | null) => partOfSpeech?.toLowerCase() ?? '';
  const ipas = (table: ReturnType<typeof pronunciationTable>) =>
    table.rows.map(row => row.cells.map(cell => cell.lines.flat().map(reading => reading.pronunciation.ipa)));

  it('has one column and no header when every sense takes the same readings (niche)', () => {
    const table = pronunciationTable([said('en-GB', 'niːʃ', [1, 2]), said('en-GB', 'nɪtʃ', [1, 2]), said('en-US', 'nɪtʃ', [1, 2])],
      groupSenses([sense(1, 'NOUN'), sense(2, 'ADJ')]), label);
    expect(table.columns).toEqual([]);
    expect(ipas(table)).toEqual([[['niːʃ', 'nɪtʃ']], [['nɪtʃ']]]);
    expect(table.pending).toBe(1);
  });

  it('makes a column of each group of senses taking the same readings, headed by their parts of speech and numbers (live)', () => {
    const table = pronunciationTable([said('en-GB', 'laɪv', [1, 2]), said('en-GB', 'lɪv', [3])],
      groupSenses([sense(1, 'ADJ'), sense(2, 'ADV'), sense(3, 'VERB')]), label);
    expect(table.columns.map(column => [column.partsOfSpeech, column.numbers])).toEqual([['adj, adv', '1–2'], ['verb', '3']]);
    expect(ipas(table)).toEqual([[['laɪv'], ['lɪv']]]);
  });

  it('repeats a reading in every column whose senses allow it, ranked as the learner\'s accent ranks them (research)', () => {
    const table = pronunciationTable([
      said('en-GB', 'rɪˈsɜːtʃ', [1, 2, 3]), said('en-GB', 'ˈriːsɜːtʃ', [1, 2]),
      said('en-US', 'ˈriːsɝtʃ', [1, 2]), said('en-US', 'rɪˈsɝtʃ', [1, 2, 3]),
    ], groupSenses([sense(1, 'NOUN'), sense(2, 'NOUN'), sense(3, 'VERB')]), label);
    expect(table.columns.map(column => column.numbers)).toEqual(['1–2', '3']);
    expect(ipas(table)).toEqual([[['rɪˈsɜːtʃ', 'ˈriːsɜːtʃ'], ['rɪˈsɜːtʃ']], [['rɪˈsɝtʃ', 'ˈriːsɝtʃ'], ['rɪˈsɝtʃ']]]);
  });

  it('collapses an accent whose readings are the same for every column into one cell spanning them', () => {
    const table = pronunciationTable([said('en-GB', 'baʊ', [1]), said('en-GB', 'bəʊ', [2]), said('en-AU', 'baʊ', [1, 2])],
      groupSenses([sense(1, 'NOUN'), sense(2, 'NOUN')]), label);
    expect(table.columns.map(column => `${column.partsOfSpeech} ${column.numbers}`)).toEqual(['noun 1', 'noun 2']);
    expect(table.rows[1].cells.map(cell => [cell.column, cell.span])).toEqual([[0, 2]]);
  });

  it('numbers the senses of a column as the list does, in ranges', () => {
    expect(numberRanges([1, 2, 3, 5])).toBe('1–3, 5');
    expect(numberRanges([1, 3])).toBe('1, 3');
    expect(numberRanges([4])).toBe('4');
  });
});
