import {LanguageCode} from '../../models/language.enum';
import {alternativesOf, comparisonOf, tierOf} from './discover-field';
import {DiscoverLexeme, DiscoverLookup, DiscoverSense, NO_ENTRY} from './discover.service';
import {ComparedSide, bestPair, compare, frameParts, nothingToCompare, soundOf, spellingParts, startingPair, summaryParts} from './word-comparison';

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
    sense('big', 1, 'ADJ', {definition: 'large in size, amount or degree', antonyms: ['small', 'little'], collocations: ['big mistake', 'big house'],
      grammar: {position: 'Attr'}}),
    sense('big', 2, 'ADJ', {definition: 'important or serious', labels: {...NO_ENTRY.labels, formality: 'informal'}, frames: ['big on sth']}),
  ], [lexeme('big', 'ADJ')]);
  const large = lookup('large', [
    sense('large', 1, 'NOUN', {definition: 'a size of clothing'}),
    sense('large', 2, 'ADJ', {definition: 'big in size, amount or number', antonyms: ['small'], collocations: ['large amount', 'a large house'],
      grammar: {position: 'Attr'}}),
  ], [lexeme('large', 'ADJ')]);
  const affect = lookup('affect', [sense('affect', 1, 'VERB')],
    [lexeme('affect', 'VERB', {relations: [{type: 'confusable', lemma: 'effect', partOfSpeech: 'NOUN', senses: []}]})]);
  const effect = lookup('effect', [sense('effect', 1, 'VERB'), sense('effect', 2, 'NOUN'), sense('effect', 3, 'NOUN')], [lexeme('effect', 'NOUN')]);

  it('reads two expressions set against each other, and nothing else, as a comparison', () => {
    expect(comparisonOf('affect vs effect')).toEqual(['affect', 'effect']);
    expect(comparisonOf('  look up  VS.  look for ')).toEqual(['look up', 'look for']);
    expect(comparisonOf('big versus large')).toEqual(['big', 'large']);
    expect(comparisonOf('big vs big')).toBeNull();
    expect(comparisonOf('canvas')).toBeNull();
    expect(tierOf('affect vs effect', 400)).toBe('compare');
    expect(tierOf('He said yes vs no.', 400)).toBe('sentence');
  });

  it('takes "or" between two single words as a question the lexicon has to settle', () => {
    expect(alternativesOf('big or large')).toEqual(['big', 'large']);
    expect(alternativesOf('more or less')).toEqual(['more', 'less']);
    expect(alternativesOf('sooner or later on')).toBeNull();
    expect(alternativesOf('orange')).toBeNull();
    expect(tierOf('big or large', 400)).toBe('word');
  });

  it('starts from the senses the lexicon sets against each other, and otherwise from the pair that names each other', () => {
    expect(startingPair(affect, affect.senses, effect, effect.senses)).toEqual([0, 1]);
    expect(startingPair(effect, effect.senses, affect, affect.senses)).toEqual([1, 0]);
    expect(startingPair(big, big.senses, large, large.senses)).toEqual([0, 1]);
    expect(bestPair(big, big.senses, large, large.senses)).toEqual([0, 1]);
  });

  it('shows only the rows that differ, says shared company once and folds what is the same', () => {
    const result = compare(side(big), side(large, 1), 'en');
    expect(result.rows.map(row => row.kind)).toEqual(['often', 'opposite']);
    expect(result.rows[0].cells.map(cell => cell.map(item => item.text))).toEqual([['big mistake'], ['large amount']]);
    expect(result.rows[1].cells.map(cell => cell.map(item => item.text))).toEqual([['small', 'little'], ['small']]);
    expect(result.either).toEqual(['house']);
    expect(result.same).toEqual(['adjective', 'only before a noun']);
    const other = compare(side(big, 1), side(large, 1), 'en');
    expect(other.rows.map(row => row.kind)).toEqual(['use', 'grammar', 'pattern', 'often', 'opposite']);
    expect(other.rows[2].cells).toEqual([[{text: 'big on sth', note: ''}], []]);
  });

  it('sets forms against each other only for a word the lexicon marks irregular', () => {
    const forms = [{form: 'went', features: {Tense: 'Past'}, varieties: [], senses: [], reading: null, note: null}];
    const go = lookup('go', [sense('go', 1, 'VERB')], [lexeme('go', 'VERB', {grammar: {irregular: true}, forms})]);
    const walk = lookup('walk', [sense('walk', 1, 'VERB')], [lexeme('walk', 'VERB', {forms})]);
    expect(compare(side(go), side(walk), 'en').rows.find(row => row.kind === 'forms')?.cells).toEqual([[{text: 'went', note: 'past'}], []]);
  });

  it('finds nothing to compare only where no relation, part of speech, spelling or sound joins the two', () => {
    const cat = lookup('cat', [sense('cat', 1, 'NOUN')], [lexeme('cat', 'NOUN')]);
    const quickly = lookup('quickly', [sense('quickly', 1, 'ADV')], [lexeme('quickly', 'ADV')]);
    const democracy = lookup('democracy', [sense('democracy', 1, 'NOUN')], [lexeme('democracy', 'NOUN')]);
    const principal = lookup('principal', [sense('principal', 1, 'ADJ')], [lexeme('principal', 'ADJ')]);
    const principle = lookup('principle', [sense('principle', 1, 'NOUN')], [lexeme('principle', 'NOUN')]);
    expect(nothingToCompare(cat, quickly)).toBeTrue();
    expect(nothingToCompare(cat, democracy)).toBeFalse();
    expect(nothingToCompare(principal, principle)).toBeFalse();
    expect(nothingToCompare(affect, lookup('effect', [sense('effect', 1, 'NOUN')], []))).toBeFalse();
  });

  it('cuts two headwords where their spellings part, when that is a few letters', () => {
    expect(spellingParts('principal', 'principle')).toEqual([
      [{text: 'princip', differs: false}, {text: 'al', differs: true}],
      [{text: 'princip', differs: false}, {text: 'le', differs: true}],
    ]);
    expect(spellingParts('affect', 'effect')?.[0][0]).toEqual({text: 'a', differs: true});
    expect(spellingParts('big', 'large')).toBeNull();
  });

  it('sets the word and the open places of a pattern apart, and the first mention of each word in a summary', () => {
    expect(frameParts('big on sth', 'big').filter(part => part.text.trim()).map(part => part.kind)).toEqual(['word', 'plain', 'slot']);
    expect(summaryParts('Use large for amounts. Use big for a big day.', ['big', 'large']).filter(part => part.word).map(part => part.text))
      .toEqual(['large', 'big']);
  });

  it('takes the reading the compared meaning has, in the wanted accent when there is one', () => {
    const said = (variety: string, ipa: string, senses: number[]) => ({variety, ipa, clipUrl: null, clipStatus: null, segments: null, senses});
    const bow = lookup('bow', [sense('bow', 1, 'NOUN'), sense('bow', 2, 'VERB')], [lexeme('bow', 'NOUN')],
      {pronunciations: [said('en-GB', 'bəʊ', [1]), said('en-GB', 'baʊ', [2]), said('en-US', 'baʊ', [2])]});
    expect(soundOf(bow, bow.senses[1], 'en-US')?.variety).toBe('en-US');
    expect(soundOf(bow, bow.senses[0], 'en-US')?.ipa).toBe('bəʊ');
  });
});
