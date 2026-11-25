import {DiscoverForm, DiscoverLexeme, NO_ENTRY} from './discover.service';
import {formLabel, grammarMarks, lexemeFacts, senseMarks} from './entry-shape';

describe('entry shape', () => {
  const varieties: Record<string, string> = {'en-GB': 'British', 'en-US': 'American', 'de-AT': 'Austrian'};
  const varietyName = (tag: string) => varieties[tag] ?? tag;
  const form = (features: Record<string, string>, extra: Partial<DiscoverForm> = {}): DiscoverForm =>
    ({form: 'x', features, varieties: [], senses: [], reading: null, note: null, ...extra});

  it('says where a sense is used first, then how, then its field', () => {
    const labels = {...NO_ENTRY.labels, formality: 'informal', attitude: ['humorous'], domain: 'computing', figurative: true};
    const regions = [{variety: 'en-GB', extent: 'only'}, {variety: 'en-IE', extent: 'mainly'}, {variety: 'es-419', extent: 'only'}];
    expect(senseMarks(labels, regions, varietyName, 'en'))
      .toEqual(['British', 'mainly Ireland', 'Latin America', 'informal', 'humorous', 'figurative', 'computing']);
  });

  it('names a UN area in the words the mobile app uses, whatever the browser calls it', () => {
    const regions = ['en-021', 'en-029', 'es-419', 'en-NZ'].map(variety => ({variety, extent: 'only'}));
    expect(senseMarks(NO_ENTRY.labels, regions, varietyName, 'en')).toEqual(['North America', 'the Caribbean', 'Latin America', 'New Zealand']);
  });

  it('shows a label this build does not know as it came', () => {
    expect(senseMarks({...NO_ENTRY.labels, style: ['very_new'], domain: 'beekeeping'}, [], varietyName, 'en')).toEqual(['very new', 'beekeeping']);
  });

  it('gives a German noun its article and plural, and other languages the name of the gender', () => {
    expect(grammarMarks({gender: 'Fem', plural_class: '-¨e', countability: 'Both'}, 'DE', varietyName))
      .toEqual(['die', 'plural -¨e', 'countable or uncountable']);
    expect(grammarMarks({gender: 'Fem'}, 'FR', varietyName)).toEqual(['feminine']);
    expect(grammarMarks({gender: 'Masc', by_variety: {'de-AT': {gender: 'Neut'}}}, 'DE', varietyName)).toEqual(['der', 'Austrian: das']);
  });

  it('says "usually" for a value that holds for most uses, and names the auxiliary in the language\'s own word', () => {
    expect(grammarMarks({position: 'Attr', mainly: ['position']}, 'EN', varietyName)).toEqual(['usually before a noun']);
    expect(grammarMarks({position: 'Attr'}, 'EN', varietyName)).toEqual(['only before a noun']);
    expect(grammarMarks({valency: 'Intr', auxiliary: 'be', irregular: true, separable: true, separable_prefix: 'auf'}, 'DE', varietyName))
      .toEqual(['intransitive', 'with sein', 'irregular', 'separable', 'prefix auf']);
    expect(grammarMarks({auxiliary: 'both'}, 'FR', varietyName)).toEqual(['with avoir or être']);
    expect(grammarMarks({comparable: false, conjugation: '1', declension: 'weak', note: 'said of people'}, 'FR', varietyName))
      .toEqual(['not comparable', 'conjugation 1', 'weak declension']);
  });

  it('names a form by its features in the order a learner says them', () => {
    expect(formLabel(form({Number: 'Plur'}), varietyName)).toBe('plural');
    expect(formLabel(form({Case: 'Gen', Number: 'Sing'}), varietyName)).toBe('genitive singular');
    expect(formLabel(form({Person: '3', Number: 'Sing', Tense: 'Pres'}), varietyName)).toBe('3rd person singular present');
    expect(formLabel(form({Tense: 'Past', VerbForm: 'Fin'}), varietyName)).toBe('past');
    expect(formLabel(form({Tense: 'Past', VerbForm: 'Part'}), varietyName)).toBe('past participle');
    expect(formLabel(form({Tense: 'Past', VerbForm: 'Fin,Part'}), varietyName)).toBe('past and past participle');
    expect(formLabel(form({Tense: 'Past', VerbForm: 'Part'}, {varieties: ['en-US'], note: 'in the passive'}), varietyName))
      .toBe('past participle, American, in the passive');
    expect(formLabel(form({}), varietyName)).toBe('');
  });

  it('gathers what holds for the whole word', () => {
    const lexeme: DiscoverLexeme = {
      index: 1, lemma: 'program', partOfSpeech: 'VERB', kind: 'word', grammar: {note: 'also written program in computing'},
      spellings: [{text: 'program', varieties: ['en-US'], preReform: false}, {text: 'programme', varieties: ['en-GB'], preReform: false}],
      forms: [form({Tense: 'Past', VerbForm: 'Fin,Part'}, {form: 'programmed'})],
      relations: [{type: 'derived_from', lemma: 'program', partOfSpeech: 'NOUN', senses: [2]}],
    };
    expect(lexemeFacts(lexeme, 'EN', varietyName)).toEqual({
      grammar: [],
      note: 'also written program in computing',
      spellings: [{text: 'program', where: 'American'}, {text: 'programme', where: 'British'}],
      forms: [{form: 'programmed', reading: null, label: 'past and past participle', senses: []}],
      relations: [{label: 'from', lemma: 'program', partOfSpeech: 'NOUN', senses: [2], compare: false}],
    });
  });
});
