import {LanguageCode} from '../../models/language.enum';
import {comparisonOf, tierOf} from './discover-field';
import {DiscoverLexeme, DiscoverLookup, DiscoverSense, NO_ENTRY} from './discover.service';
import {ComparedSide, bestPair, comparisonLinks, comparisonRows, soundOf} from './word-comparison';

describe('word comparison', () => {
  const sense = (headword: string, index: number, partOfSpeech: string, more: Partial<DiscoverSense> = {}): DiscoverSense =>
    ({index, key: null, headword, partOfSpeech, transcription: null, translations: [], definition: null, cefr: null, examples: [], ...NO_ENTRY, lexeme: 1, ...more});
  const lexeme = (lemma: string, partOfSpeech: string, more: Partial<DiscoverLexeme> = {}): DiscoverLexeme =>
    ({index: 1, lemma, partOfSpeech, kind: 'word', grammar: {}, spellings: [], forms: [], relations: [], ...more});
  const lookup = (entry: string, senses: DiscoverSense[], lexemes: DiscoverLexeme[], more: Partial<DiscoverLookup> = {}): DiscoverLookup => ({
    entry, sourceContext: null, language: LanguageCode.EN, translationLanguage: LanguageCode.UK, provider: 'lexicon', frequency: null,
    pronunciations: [], homophones: [], senses, lexemes, requestedLanguage: null, availableLanguages: [], scriptMismatch: false, ...more,
  });
  const side = (of: DiscoverLookup, at = 0): ComparedSide => ({lookup: of, sense: of.senses[at], varietyName: tag => tag});

  const big = lookup('big', [
    sense('big', 1, 'ADJ', {definition: 'large in size, amount or degree', cefr: 'A1', antonyms: ['small', 'little']}),
    sense('big', 2, 'ADJ', {definition: 'important or serious', cefr: 'A2', labels: {...NO_ENTRY.labels, formality: 'informal'}, frames: ['big in sth']}),
  ], [lexeme('big', 'ADJ', {grammar: {comparable: true}})]);
  const large = lookup('large', [
    sense('large', 1, 'NOUN', {definition: 'a size of clothing'}),
    sense('large', 2, 'ADJ', {definition: 'big in size, amount or number', cefr: 'A1', antonyms: ['small'], collocations: ['large amount']}),
  ], [lexeme('large', 'ADJ')]);
  const affect = lookup('affect', [sense('affect', 1, 'VERB', {translations: ['впливати']})],
    [lexeme('affect', 'VERB', {relations: [{type: 'confusable', lemma: 'effect', partOfSpeech: 'NOUN', senses: []}]})]);
  const effect = lookup('effect', [sense('effect', 1, 'NOUN'), sense('effect', 2, 'NOUN'), sense('effect', 3, 'VERB')], [lexeme('effect', 'NOUN')]);

  it('reads two expressions set against each other, and nothing else, as a comparison', () => {
    expect(comparisonOf('affect vs effect')).toEqual(['affect', 'effect']);
    expect(comparisonOf('  look up  VS.  look for ')).toEqual(['look up', 'look for']);
    expect(comparisonOf('big versus large')).toEqual(['big', 'large']);
    expect(comparisonOf('big vs big')).toBeNull();
    expect(comparisonOf('vs')).toBeNull();
    expect(comparisonOf('canvas')).toBeNull();
    expect(tierOf('affect vs effect', 400)).toBe('compare');
    expect(tierOf('one two three vs four five six', 400)).toBe('compare');
    expect(tierOf('He said yes vs no.', 400)).toBe('sentence');
  });

  it('starts from the meanings that name each other, and from the leading ones when nothing links them', () => {
    expect(bestPair(big, big.senses, large, large.senses)).toEqual([0, 1]);
    expect(bestPair(affect, affect.senses, effect, effect.senses)).toEqual([0, 0]);
  });

  it('marks what the two share and leaves out a row neither has anything for', () => {
    const rows = comparisonRows(side(big), side(large, 1), 'en');
    expect(rows.map(row => row.kind)).toEqual(['level', 'often', 'opposite']);
    expect(rows[0].same).toBeTrue();
    expect(rows[1].cells).toEqual([[], [{text: 'large amount', note: '', shared: false}]]);
    expect(rows[2].same).toBeFalse();
    expect(rows[2].cells[0].map(item => [item.text, item.shared])).toEqual([['small', true], ['little', false]]);
    const second = comparisonRows(side(big, 1), side(large, 1), 'en');
    expect(second.find(row => row.kind === 'use')?.cells[0][0].text).toBe('informal');
    expect(second.find(row => row.kind === 'pattern')?.cells[0][0].text).toBe('big in sth');
  });

  it('lists a verb’s forms only when a learner could not guess them', () => {
    const forms = [{form: 'went', features: {Tense: 'Past'}, varieties: [], senses: [], reading: null, note: null}];
    const go = lookup('go', [sense('go', 1, 'VERB')], [lexeme('go', 'VERB', {grammar: {irregular: true}, forms})]);
    const walk = lookup('walk', [sense('walk', 1, 'VERB')], [lexeme('walk', 'VERB', {grammar: {irregular: false}, forms})]);
    const row = comparisonRows(side(go), side(walk), 'en').find(each => each.kind === 'forms');
    expect(row?.cells).toEqual([[{text: 'went', note: 'past', shared: false}], []]);
  });

  it('says what the lexicon links the two words by', () => {
    expect(comparisonLinks(side(affect), side(effect))).toEqual(['Often confused with each other']);
    expect(comparisonLinks(side(big), side(large, 1))).toEqual([]);
    const small = lookup('small', [sense('small', 1, 'ADJ')], [lexeme('small', 'ADJ')]);
    expect(comparisonLinks(side(big), side(small))).toEqual(['Opposites']);
    const led = lookup('led', [sense('led', 1, 'VERB')], [lexeme('led', 'VERB')]);
    const lead = lookup('lead', [sense('lead', 1, 'NOUN')], [lexeme('lead', 'NOUN')], {homophones: [{word: 'led', varieties: ['en-GB'], senses: [1]}]});
    expect(comparisonLinks(side(lead), side(led))).toEqual(['Said exactly alike']);
  });

  it('takes the reading the compared meaning has, in the wanted accent when there is one', () => {
    const said = (variety: string, ipa: string, senses: number[]) => ({variety, ipa, clipUrl: null, clipStatus: null, segments: null, senses});
    const bow = lookup('bow', [sense('bow', 1, 'NOUN'), sense('bow', 2, 'VERB')], [lexeme('bow', 'NOUN')],
      {pronunciations: [said('en-GB', 'bəʊ', [1]), said('en-GB', 'baʊ', [2]), said('en-US', 'baʊ', [2])]});
    expect(soundOf(bow, bow.senses[1], 'en-US')?.variety).toBe('en-US');
    expect(soundOf(bow, bow.senses[1], null)?.ipa).toBe('baʊ');
    expect(soundOf(bow, bow.senses[0], 'en-US')?.ipa).toBe('bəʊ');
  });
});
