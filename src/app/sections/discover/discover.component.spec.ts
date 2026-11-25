import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {AppConstants} from '../../app.constants';
import {LanguageCode} from '../../models/language.enum';
import {CEFRLevel, DEFAULT_UI_PREFERENCES, Learner, UserInfo} from '../../models/userinfo.model';
import {CardDto} from '../../models/card.model';
import {CardService} from '../../services/card.service';
import {TargetLanguageDropdownService} from '../../services/target-language-dropdown.service';
import {UserInfoService} from '../../services/user-info.service';
import {DiscoverComponent} from './discover.component';
import {DiscoverLookup, DiscoverPronunciation, DiscoverService, DiscoverSuggestion, NO_ENTRY} from './discover.service';
import {EntryReportService} from './report/entry-report.service';

describe('DiscoverComponent', () => {
  const british: DiscoverPronunciation = {variety: 'en-GB', ipa: 'ˈkʌlə', clipUrl: '/public/lexicon/clips/clip-gb', clipStatus: 'verified',
    segments: [{text: 'ˈkʌl', differs: false}, {text: 'ə', differs: true}], senses: [1, 2]};
  const american: DiscoverPronunciation = {variety: 'en-US', ipa: 'ˈkʌlɚ', clipUrl: null, clipStatus: null,
    segments: [{text: 'ˈkʌl', differs: false}, {text: 'ɚ', differs: true}], senses: [1, 2]};
  const australian: DiscoverPronunciation = {variety: 'en-AU', ipa: 'ˈkalə', clipUrl: '/public/lexicon/clips/clip-au', clipStatus: 'unverified', segments: null, senses: [1, 2]};

  function lookupOf(pronunciations: DiscoverPronunciation[]): DiscoverLookup {
    return {
      entry: 'colour', sourceContext: null, language: LanguageCode.EN, translationLanguage: LanguageCode.UK, provider: 'lexicon',
      frequency: null, pronunciations, homophones: [], lexemes: [],
      requestedLanguage: null, availableLanguages: [], scriptMismatch: false,
      senses: [
        {
          index: 1, key: null, headword: 'colour', partOfSpeech: 'noun', transcription: null, translations: ['колір'],
          definition: 'The property of an object that depends on the light it reflects.', cefr: 'A1',
          examples: [{text: 'What colour is it?', translation: 'Якого воно кольору?'}], ...NO_ENTRY,
        },
        {index: 2, key: null, headword: 'colour', partOfSpeech: 'verb', transcription: null, translations: ['фарбувати'], definition: null, cefr: null, examples: [], ...NO_ENTRY},
      ],
    };
  }

  let fixture: ComponentFixture<DiscoverComponent>;
  let lookupSpy: jasmine.Spy;
  let suggestSpy: jasmine.Spy;
  let explainSpy: jasmine.Spy;
  let createCardSpy: jasmine.Spy;
  let reportSpy: jasmine.Spy;
  let savedCards: CardDto[] = [];
  const SUGGESTIONS: DiscoverSuggestion[] = [
    {headword: 'Ausgabe', partOfSpeech: 'NOUN', gender: 'Fem', gloss: 'edition'},
    {headword: 'ausgehen', partOfSpeech: 'VERB', gender: null, gloss: 'go out'},
    {headword: 'Ausgang', partOfSpeech: 'NOUN', gender: 'Masc', gloss: null},
  ];

  async function render(lookup: DiscoverLookup, variety: string | null, query: Record<string, string> = {text: 'colour'}): Promise<HTMLElement> {
    lookupSpy = jasmine.createSpy('lookup').and.returnValue(of(lookup));
    suggestSpy = jasmine.createSpy('suggest').and.returnValue(of(SUGGESTIONS));
    createCardSpy = jasmine.createSpy('createCard').and.returnValue(of({id: 'card-new'}));
    reportSpy = jasmine.createSpy('report').and.returnValue(of({id: 'report-1'}));
    explainSpy = jasmine.createSpy('explainDifference').and.callFake((_first: string, _second: string, _language: LanguageCode, generate: boolean) =>
      of({summary: generate ? 'Colour is the noun; paint is what you put on a wall.' : null, capped: false}));
    const discoverService = {lookup: lookupSpy, suggest: suggestSpy, explainDifference: explainSpy};
    const learners = variety === null ? [] : [new Learner('learner-1', LanguageCode.EN, CEFRLevel.B1, true, variety)];
    await TestBed.configureTestingModule({
      imports: [DiscoverComponent],
      providers: [
        provideRouter([]),
        {provide: ActivatedRoute, useValue: {paramMap: of(convertToParamMap({})), queryParamMap: of(convertToParamMap(query))}},
        {provide: DiscoverService, useValue: discoverService},
        {provide: EntryReportService, useValue: {report: reportSpy}},
        {provide: CardService, useValue: {createCard: createCardSpy, deleteCard: jasmine.createSpy('deleteCard'), getCardsInLanguage: () => of(savedCards)}},
        {provide: TargetLanguageDropdownService, useValue: {currentLanguage$: of(LanguageCode.EN), setCurrentLanguage: () => undefined}},
        {provide: UserInfoService, useValue: {currentUserInfo: variety === null ? null : {learners, fluentLangs: [LanguageCode.UK], activeTargetLangs: [LanguageCode.EN], uiPreferences: DEFAULT_UI_PREFERENCES} as unknown as UserInfo}},
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DiscoverComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function pronunciationRows(element: HTMLElement): HTMLElement[] {
    return Array.from(element.querySelectorAll<HTMLElement>('.pronunciations .accent'));
  }

  describe('words said alike', () => {
    it('link to their own sheets, saying where and for which meanings they hold when not everywhere', async () => {
      const lookup = lookupOf([british, american]);
      lookup.homophones = [{word: 'culler', varieties: ['en-GB', 'en-US'], senses: [1, 2]}, {word: 'cullah', varieties: ['en-GB'], senses: [1]}];
      const element = await render(lookup, null);
      const line = element.querySelector<HTMLElement>('.homophones')!;
      expect(line.querySelector('.label')?.textContent).toBe('Sounds like');
      const links = Array.from(line.querySelectorAll('a:not(.compare)'));
      expect(links.map(link => link.textContent)).toEqual(['culler', 'cullah']);
      expect(line.querySelector('a.compare')?.getAttribute('href')).toBe('/discover/en?text=colour%20vs%20culler');
      expect(links[0].getAttribute('href')).toBe('/discover/en?text=culler');
      expect(Array.from(line.querySelectorAll('.note')).map(note => note.textContent)).toEqual(['(British, meaning 1)']);
    });

    it('show nothing when there are none', async () => {
      const element = await render(lookupOf([british]), null);
      expect(element.querySelector('.homophones')).toBeNull();
    });
  });

  describe('a report', () => {
    function keyed(): DiscoverLookup {
      const lookup = lookupOf([british]);
      lookup.sourceContext = 'What colour is the sky?';
      lookup.senses = lookup.senses.map(sense => ({...sense, key: `key-${sense.index}`}));
      return lookup;
    }

    it('flags the selected sense with its key, the sentence and the book', async () => {
      const element = await render(keyed(), 'en-GB', {text: 'colour', book: 'little-prince-en'});
      element.querySelectorAll<HTMLElement>('.sense')[1].click();
      fixture.detectChanges();
      const flags = element.querySelectorAll<HTMLButtonElement>('.sense button.flag');
      expect(flags.length).toBe(1);
      flags[0].click();
      fixture.detectChanges();
      const panel = element.querySelector<HTMLElement>('.sense app-entry-report')!;
      expect(panel.querySelector('legend')?.textContent).toContain('sense 2 of “colour”');
      const reasons = Array.from(panel.querySelectorAll<HTMLInputElement>('input[type=radio]'));
      expect(reasons.length).toBe(5);
      reasons[3].click();
      fixture.detectChanges();
      panel.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
      expect(reportSpy).toHaveBeenCalledWith({
        language: LanguageCode.EN, headword: 'colour', senseKey: 'key-2', reason: 'WRONG_SOUND', comment: null,
        context: 'What colour is the sky?', book: 'little-prince-en',
      });
      fixture.detectChanges();
      expect(panel.textContent).toContain('Thanks');
    });

    it('flags the whole word from the header, without “doesn’t fit” when there is no sentence', async () => {
      const lookup = keyed();
      lookup.sourceContext = null;
      const element = await render(lookup, 'en-GB');
      element.querySelector<HTMLButtonElement>('.entry-header button.word-flag')!.click();
      fixture.detectChanges();
      const panel = element.querySelector<HTMLElement>('.entry-header app-entry-report')!;
      expect(panel.querySelectorAll('input[type=radio]').length).toBe(4);
      expect(panel.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBeTrue();
      expect(panel.querySelector('.report__hint')?.textContent).toContain('Pick what is wrong');
    });

    it('is not offered to a guest, nor on an entry the lexicon did not write', async () => {
      let element = await render(keyed(), null);
      expect(element.querySelector('button.flag')).toBeNull();
      TestBed.resetTestingModule();
      const old = keyed();
      old.provider = 'yandex';
      element = await render(old, 'en-GB');
      expect(element.querySelector('button.flag')).toBeNull();
    });
  });

  describe('a sense kept by its key', () => {
    afterEach(() => savedCards = []);

    it('stays kept after its entry is rewritten, and a new keep stores the key', async () => {
      const lookup = lookupOf([british]);
      lookup.senses = lookup.senses.map(sense => ({...sense, key: `key-${sense.index}`}));
      savedCards = [{id: 'card-1', entry: 'colour', language: 'EN', translations: [], selectedSense: '1: wording before the rewrite', senseKey: 'key-1'}];
      const element = await render(lookup, 'en-GB');
      expect(element.querySelectorAll('button.kept').length).toBe(1);
      element.querySelectorAll<HTMLElement>('.sense')[1].click();
      fixture.detectChanges();
      element.querySelector<HTMLButtonElement>('button.keep')?.click();
      expect(createCardSpy).toHaveBeenCalledWith(jasmine.objectContaining({senseKey: 'key-2'}));
    });
  });

  it('tints the runs the server marks as differing, and shows a transcription without segments as it is', async () => {
    const element = await render(lookupOf([british, australian]), null);
    const rows = pronunciationRows(element);
    expect(rows[0].querySelector('.transcription')?.textContent).toBe('ˈkʌlə');
    expect(Array.from(rows[0].querySelectorAll('.differs')).map(span => span.textContent)).toEqual(['ə']);
    expect(rows[1].querySelector('.transcription')?.textContent).toBe('ˈkalə');
    expect(rows[1].querySelector('.differs')).toBeNull();
  });

  it('shows each variety with its IPA and a speaker for every one', async () => {
    const element = await render(lookupOf([british, american]), null);
    const rows = pronunciationRows(element);
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('British');
    expect(rows[0].textContent).toContain('ˈkʌlə');
    expect(rows[0].querySelector('.differs')?.textContent).toBe('ə');
    expect(rows[1].querySelector('.differs')?.textContent).toBe('ɚ');
    expect(rows[0].querySelector('button.speaker')?.getAttribute('aria-label')).toBe('Play the British pronunciation');
    expect(rows[0].querySelector('.unverified')).toBeNull();
    expect(rows[1].textContent).toContain('American');
    expect(rows[1].querySelector('button.speaker')).not.toBeNull();
  });

  it('keeps a row and a speaker for every variety even when they transcribe the word alike', async () => {
    const alike = [{text: 'ˈkʌlə', differs: false}];
    const element = await render(lookupOf([{...british, segments: alike}, {...australian, ipa: 'ˈkʌlə', segments: alike}]), null);
    const rows = pronunciationRows(element);
    expect(rows.length).toBe(2);
    expect(rows.map(row => row.querySelector('.variety')?.textContent?.trim())).toEqual(['British', 'Australian']);
    expect(rows.map(row => row.querySelectorAll('button.speaker').length)).toEqual([1, 1]);
    expect(element.querySelector('.differs')).toBeNull();
  });

  describe('a variety recording alternatives (niche)', () => {
    const niche = (variety: string, ipa: string, clipUrl: string | null = null, senses = [1, 2]): DiscoverPronunciation =>
      ({variety, ipa, clipUrl, clipStatus: clipUrl ? 'verified' : null, segments: [{text: ipa, differs: true}], senses});

    it('holds them on its row joined by "or", each with its own speaker', async () => {
      const element = await render(lookupOf([niche('en-GB', '/ˈniːʃ/'), niche('en-GB', '/ˈnɪtʃ/'),
        niche('en-US', '/ˈnɪtʃ/'), niche('en-US', '/ˈniːʃ/')]), null);
      const rows = pronunciationRows(element);
      expect(rows.length).toBe(2);
      expect(Array.from(rows[0].querySelectorAll('.transcription')).map(span => span.textContent)).toEqual(['/ˈniːʃ/', '/ˈnɪtʃ/']);
      expect(Array.from(rows[1].querySelectorAll('.transcription')).map(span => span.textContent)).toEqual(['/ˈnɪtʃ/', '/ˈniːʃ/']);
      expect(rows[0].querySelectorAll('.or').length).toBe(1);
      expect(element.querySelectorAll('.pronunciations button.speaker').length).toBe(4);
    });

    it('greys the speaker of an alternative with no clip past the first, and says why under the row', async () => {
      const element = await render(lookupOf([niche('en-GB', '/ˈniːʃ/'), niche('en-GB', '/ˈnɪtʃ/')]), null);
      const speakers = Array.from(element.querySelectorAll<HTMLButtonElement>('.pronunciations button.speaker'));
      expect(speakers.map(speaker => speaker.disabled)).toEqual([false, true]);
      expect(element.querySelector('.entry-header .pending')?.textContent).toContain('The greyed one has no recording yet.');
    });

    it('plays each alternative from its own clip', async () => {
      const play = spyOn(HTMLMediaElement.prototype, 'play').and.resolveTo();
      const element = await render(lookupOf([niche('en-GB', '/ˈniːʃ/', '/public/lexicon/clips/neesh'),
        niche('en-GB', '/ˈnɪtʃ/', '/public/lexicon/clips/nitch')]), null);
      const speakers = Array.from(element.querySelectorAll<HTMLButtonElement>('.pronunciations button.speaker'));
      expect(speakers.map(speaker => speaker.disabled)).toEqual([false, false]);
      expect(element.querySelector('.entry-header .pending')).toBeNull();
      speakers[1].click();
      fixture.detectChanges();
      expect((play.calls.mostRecent().object as HTMLAudioElement).src).toBe(`${AppConstants.API_URL}/public/lexicon/clips/nitch`);
      expect(speakers[1].classList).toContain('on');
      expect(speakers[0].classList).not.toContain('on');
    });

    it('moves a third alternative to a line under the first two', async () => {
      const element = await render(lookupOf([niche('en-GB', '/a/'), niche('en-GB', '/b/'), niche('en-GB', '/c/')]), null);
      const lines = Array.from(element.querySelectorAll<HTMLElement>('.pronunciations .voice-line'));
      expect(lines.map(line => line.querySelectorAll('.transcription').length)).toEqual([2, 1]);
      expect(lines[1].querySelector('.or')).not.toBeNull();
    });

    it('sets readings that follow the meaning in columns headed by part of speech, and lights the selected sense\'s', async () => {
      const element = await render(lookupOf([niche('en-GB', '/ˈkʌlə/', null, [1]), niche('en-GB', '/ˈkʌlɜː/', null, [2])]), null);
      const heads = Array.from(element.querySelectorAll<HTMLElement>('.head .column-head')).map(head => head.textContent?.replace(/\s+/g, ' ').trim());
      expect(heads).toEqual(['noun 1', 'verb 2']);
      const row = pronunciationRows(element)[0];
      expect(row.querySelectorAll('.cell').length).toBe(2);
      expect(row.querySelector('.or')).toBeNull();
      expect(element.querySelector('.band')?.getAttribute('style')).toContain('grid-area: 1 / 2 / 3 / 3');
      (element.querySelectorAll<HTMLElement>('.sense')[1]).dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();
      expect(element.querySelector('.band')?.getAttribute('style')).toContain('grid-area: 1 / 3 / 3 / 4');
    });

    it('lights the senses taking the reading under the pointer', async () => {
      const element = await render(lookupOf([niche('en-GB', '/ˈkʌlə/', null, [1]), niche('en-GB', '/ˈkʌlɜː/', null, [2])]), null);
      element.querySelectorAll<HTMLElement>('.pronunciations .voice')[1].dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();
      expect(Array.from(element.querySelectorAll('.sense')).map(sense => sense.classList.contains('lit'))).toEqual([false, true]);
    });
  });

  it('keeps the server order when the learner has not chosen a variety', async () => {
    const element = await render(lookupOf([british, american, australian]), null);
    expect(pronunciationRows(element).map(row => row.querySelector('.variety')?.textContent?.trim())).toEqual(['British', 'American', 'Australian']);
  });

  it('puts the variety the learner chose for the language first', async () => {
    const element = await render(lookupOf([british, american, australian]), 'en-AU');
    expect(pronunciationRows(element).map(row => row.querySelector('.variety')?.textContent?.trim())).toEqual(['Australian', 'British', 'American']);
  });

  it('marks an unverified clip, plays it from the API base, and replays it slow on a second click', async () => {
    const play = spyOn(HTMLMediaElement.prototype, 'play').and.resolveTo();
    const element = await render(lookupOf([australian]), null);
    const row = pronunciationRows(element)[0];
    const mark = row.querySelector<HTMLElement>('.unverified');
    expect(mark?.textContent).toContain('unverified');
    expect(mark?.title).toContain('did not confirm');
    const speaker = row.querySelector<HTMLButtonElement>('button.speaker')!;
    speaker.click();
    expect(play).toHaveBeenCalledTimes(1);
    const audio = play.calls.mostRecent().object as HTMLAudioElement;
    expect(audio.src).toBe(`${AppConstants.API_URL}/public/lexicon/clips/clip-au`);
    expect(audio.playbackRate).toBe(1);
    fixture.detectChanges();
    expect(speaker.classList).toContain('on');
    speaker.click();
    fixture.detectChanges();
    expect((play.calls.mostRecent().object as HTMLAudioElement).playbackRate).toBe(0.6);
    expect(row.querySelector('.slow')?.textContent).toContain('slow');
  });

  it('groups the senses by part of speech, each with its level and one example, the word set apart', async () => {
    const element = await render(lookupOf([british]), null);
    const groups = Array.from(element.querySelectorAll<HTMLElement>('.group'));
    expect(groups.map(group => group.querySelector('.part-of-speech')?.textContent?.trim())).toEqual(['noun', 'verb']);
    const senses = Array.from(element.querySelectorAll<HTMLElement>('.sense'));
    expect(senses.map(sense => sense.querySelector('.number')?.textContent?.trim())).toEqual(['1', '2']);
    expect(senses[0].querySelector('.cefr')?.textContent?.trim()).toBe('A1');
    expect(senses[0].querySelector('.example-text .word')?.textContent).toBe('colour');
    expect(senses[1].querySelector('.cefr')).toBeNull();
    expect(senses[1].querySelector('.example')).toBeNull();
    expect(element.querySelector('.examples')).toBeNull();
  });

  it('leads with the translation for a guest and with the definition for a learner from B1', async () => {
    let element = await render(lookupOf([]), null);
    let first = element.querySelector<HTMLElement>('.sense')!;
    expect(first.querySelector('.lead')?.textContent).toBe('колір');
    expect(first.querySelector('.sub')?.textContent).toContain('The property of an object');
    TestBed.resetTestingModule();
    element = await render(lookupOf([]), 'en-GB');
    first = element.querySelector<HTMLElement>('.sense')!;
    expect(first.querySelector('.lead')?.textContent).toContain('The property of an object');
    expect(first.querySelector('.sub')?.textContent).toBe('колір');
  });

  it('shows three senses, then the rest on request with the hidden count per part of speech', async () => {
    const lookup = lookupOf([]);
    lookup.senses = [
      ...[1, 2, 3, 4].map(index => ({index, key: null, headword: 'colour', partOfSpeech: 'NOUN', transcription: null, translations: [`n${index}`], definition: null, cefr: null, examples: [], ...NO_ENTRY})),
      {index: 5, key: null, headword: 'colour', partOfSpeech: 'VERB', transcription: null, translations: ['v'], definition: null, cefr: null, examples: [], ...NO_ENTRY},
    ];
    const element = await render(lookup, null);
    expect(element.querySelectorAll('.sense').length).toBe(3);
    const more = element.querySelector<HTMLElement>('.more')!;
    expect(more.querySelector('button')?.textContent).toContain('Show 2 more');
    expect(more.querySelector('span')?.textContent).toBe('1 noun · 1 verb');
    more.querySelector('button')!.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('.sense').length).toBe(5);
    expect(element.querySelector('.more button')?.textContent).toContain('Fewer senses');
  });

  it('puts Keep on the selected row only, and moves it with a click', async () => {
    const element = await render(lookupOf([]), null);
    let senses = Array.from(element.querySelectorAll<HTMLElement>('.sense'));
    expect(senses[0].querySelector('.keep')).not.toBeNull();
    expect(senses[1].querySelector('.keep')).toBeNull();
    senses[1].click();
    fixture.detectChanges();
    senses = Array.from(element.querySelectorAll<HTMLElement>('.sense'));
    expect(senses[0].querySelector('.keep')).toBeNull();
    expect(senses[1].classList).toContain('selected');
    expect(senses[1].querySelector('.keep')).not.toBeNull();
  });

  it('renders a lookup from a backend without lexicon fields', async () => {
    const lookup = lookupOf([]);
    lookup.senses = [{index: 1, key: null, headword: 'colour', partOfSpeech: 'noun', transcription: 'ˈkʌlə', translations: ['колір'], definition: null, cefr: null, examples: [], ...NO_ENTRY}];
    const element = await render(lookup, 'en-GB');
    expect(element.querySelector('.pronunciations')).toBeNull();
    expect(element.querySelector('.entry-header .transcription')?.textContent).toContain('ˈkʌlə');
    expect(element.querySelector('.sense .lead')?.textContent).toBe('колір');
    expect(element.querySelector('.sense .sub')).toBeNull();
  });

  describe('the line', () => {
    beforeEach(() => localStorage.clear());

    function field(element: HTMLElement): HTMLTextAreaElement {
      return element.querySelector<HTMLTextAreaElement>('textarea')!;
    }

    function type(element: HTMLElement, value: string): void {
      const textarea = field(element);
      textarea.value = value;
      textarea.setSelectionRange(value.length, value.length);
      textarea.dispatchEvent(new Event('input'));
    }

    function press(element: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
      const event = new KeyboardEvent('keydown', {key, cancelable: true, ...init});
      field(element).dispatchEvent(event);
      return event;
    }

    async function renderEmpty(query: Record<string, string> = {}): Promise<{element: HTMLElement; detect: () => void}> {
      const element = await render(lookupOf([]), null, query);
      return {element, detect: () => fixture.detectChanges()};
    }

    it('rests as one line with no button until there is something to run', async () => {
      const {element} = await renderEmpty({language: 'de'});
      expect(element.querySelector('h1')).toBeNull();
      expect(element.querySelector('.placeholder')?.textContent).toContain('Type a word, or paste a sentence');
      expect(element.querySelector('button.run')).toBeNull();
    });

    it('names what Enter will do from the length and shape of the text', async () => {
      const {element, detect} = await renderEmpty({language: 'de'});
      type(element, 'Ausgabe');
      detect();
      expect(element.querySelector('button.run')?.textContent).toContain('Look up');
      type(element, 'Die neueste Ausgabe lag ungelesen dort.');
      detect();
      expect(element.querySelector('button.run')?.textContent).toContain('Break down');
      type(element, 'x'.repeat(401));
      detect();
      expect(element.querySelector('button.run')?.textContent).toContain('Sign in for longer text');
      expect(element.querySelector('.count')?.textContent).toContain('401');
    });

    it('offers the letter ring after a letter and cycles it back to the plain letter with ↑', async () => {
      const {element, detect} = await renderEmpty({language: 'de'});
      type(element, 'Br');
      type(element, 'Bru');
      detect();
      expect(element.querySelector('.chip')?.textContent).toContain('ü');
      expect(press(element, 'ArrowUp').defaultPrevented).toBeTrue();
      detect();
      expect(field(element).value).toBe('Brü');
      press(element, 'ArrowUp');
      detect();
      expect(field(element).value).toBe('Bru');
      press(element, 'c');
      detect();
      expect(element.querySelector('.chip')).toBeNull();
    });

    it('clears on Escape and keeps Shift+Enter for a new line', async () => {
      const {element, detect} = await renderEmpty({language: 'de'});
      type(element, 'Ausgabe');
      detect();
      expect(press(element, 'Enter', {shiftKey: true}).defaultPrevented).toBeFalse();
      press(element, 'Escape');
      detect();
      expect(field(element).value).toBe('');
    });

    it('gives a guest the language of the link, with its letters in the menu', async () => {
      const {element, detect} = await renderEmpty({language: 'fr'});
      const token = element.querySelector<HTMLButtonElement>('.token')!;
      expect(token.textContent).toContain('French');
      token.click();
      detect();
      const german = Array.from(element.querySelectorAll<HTMLElement>('.language-menu button')).find(row => row.textContent?.includes('German'));
      expect(german?.querySelector('.letters')?.textContent).toBe('ä ö ü ß');
    });

    it('clears the recent lookups of the field language', async () => {
      localStorage.setItem('discover.recents.DE', JSON.stringify(['der Anschlag', 'vorläufig']));
      localStorage.setItem('discover.recents.FR', JSON.stringify(['la pluie']));
      const {element, detect} = await renderEmpty({language: 'de'});
      expect(Array.from(element.querySelectorAll('.recents button')).map(button => button.textContent?.trim())).toEqual(['der Anschlag', 'vorläufig']);
      element.querySelector<HTMLButtonElement>('.clear-recents')!.click();
      detect();
      expect(element.querySelector('.recents')).toBeNull();
      expect(element.querySelector('.clear-recents')).toBeNull();
      expect(localStorage.getItem('discover.recents.DE')).toBe('[]');
      expect(localStorage.getItem('discover.recents.FR')).toBe('["la pluie"]');
    });

    function settle(): Promise<void> {
      return new Promise(resolve => setTimeout(resolve, 200));
    }

    it('offers headwords from the lexicon while a word is typed, with the German article', async () => {
      const {element, detect} = await renderEmpty({language: 'de'});
      type(element, 'Ausg');
      await settle();
      detect();
      expect(suggestSpy).toHaveBeenCalledOnceWith('Ausg', LanguageCode.DE, LanguageCode.EN);
      const rows = Array.from(element.querySelectorAll<HTMLElement>('.suggestions li'));
      expect(rows.map(row => row.querySelector('.headword')?.textContent?.trim())).toEqual(['die Ausgabe', 'ausgehen', 'der Ausgang']);
      expect(rows[0].querySelector('.gloss')?.textContent).toContain('edition');
      expect(rows[2].querySelector('.gloss')).toBeNull();
      expect(element.querySelector('.as-typed')?.textContent).toContain('“Ausg”');
    });

    it('walks the rows with ↓ and opens the chosen one with Enter', async () => {
      const {element, detect} = await renderEmpty({language: 'de'});
      type(element, 'Ausg');
      await settle();
      detect();
      press(element, 'ArrowDown');
      press(element, 'ArrowDown');
      detect();
      expect(element.querySelector('.suggestions li.active .headword')?.textContent).toContain('ausgehen');
      press(element, 'ArrowUp');
      press(element, 'Enter');
      detect();
      expect(lookupSpy).toHaveBeenCalledWith('Ausgabe', LanguageCode.DE, LanguageCode.EN, undefined);
      expect(field(element).value).toBe('Ausgabe');
      expect(element.querySelector('.suggestions')).toBeNull();
    });

    it('asks for nothing once the line holds a sentence', async () => {
      const {element, detect} = await renderEmpty({language: 'de'});
      type(element, 'Die Ausgabe lag dort.');
      await settle();
      detect();
      expect(suggestSpy).not.toHaveBeenCalled();
      expect(element.querySelector('.suggestions')).toBeNull();
    });
  });

  describe('two words set against each other', () => {
    const keyed = (): DiscoverLookup => {
      const lookup = lookupOf([british]);
      lookup.senses = lookup.senses.map((sense, at) => ({...sense, key: `key-${at}`}));
      return lookup;
    };

    it('looks both up and shows them as one sheet, with only the rows they differ in', async () => {
      const element = await render(lookupOf([british]), null, {text: 'colour vs paint'});
      expect(lookupSpy.calls.allArgs().map(args => args[0] as string)).toEqual(['colour', 'paint']);
      expect(element.querySelector('.word-sheet')).toBeNull();
      expect(element.querySelector('.run')?.textContent).toContain('Compare');
      const sheet = element.querySelector<HTMLElement>('app-word-comparison')!;
      expect(Array.from(sheet.querySelectorAll('.headword')).map(word => word.textContent)).toEqual(['colour', 'colour']);
      expect(sheet.querySelector('.sound.merged')?.textContent).toContain('Said the same');
      expect(Array.from(sheet.querySelectorAll('.row .label')).map(label => label.textContent?.trim())).toEqual(['Example']);
      expect(sheet.querySelector('.same')?.textContent).toContain('noun');
      expect(sheet.querySelector('.sense-of')?.textContent).toContain('Sense 1 of 2');
    });

    it('opens a word’s sense list in place and compares by the meaning picked', async () => {
      const element = await render(lookupOf([british]), null, {text: 'colour vs paint'});
      element.querySelector<HTMLButtonElement>('.sense-of')!.click();
      fixture.detectChanges();
      const choices = Array.from(element.querySelectorAll<HTMLButtonElement>('.sense-list button'));
      expect(choices.length).toBe(2);
      choices[1].click();
      fixture.detectChanges();
      expect(element.querySelector('.sense-of')?.textContent).toContain('Sense 2 of 2');
      expect(element.querySelector('.sense-list')).toBeNull();
      expect(Array.from(element.querySelectorAll('.meaning .part')).map(part => part.textContent?.trim())).toEqual(['verb', 'noun']);
    });

    it('keeps the meaning compared, as a sense on the sheet is kept', async () => {
      const element = await render(keyed(), 'en-GB', {text: 'colour vs paint'});
      element.querySelector<HTMLButtonElement>('app-word-comparison .keep')!.click();
      fixture.detectChanges();
      expect(createCardSpy.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({entry: 'colour', senseKey: 'key-0', partOfSpeech: 'noun'}));
      expect(element.querySelector('app-word-comparison .kept')).not.toBeNull();
    });

    it('starts from the sense whose own link opened the comparison', async () => {
      const element = await render(lookupOf([british]), null, {text: 'colour vs paint', sense: '2'});
      expect(element.querySelector('.sense-of')?.textContent).toContain('Sense 2 of 2');
    });

    it('asks a signed-in reader before writing the difference, and looks for one already written without being asked', async () => {
      const element = await render(keyed(), 'en-GB', {text: 'colour vs paint'});
      expect(explainSpy.calls.allArgs()).toEqual([['key-0', 'key-0', LanguageCode.UK, false]]);
      expect(element.querySelector('.summary')).toBeNull();
      element.querySelector<HTMLButtonElement>('.explain')!.click();
      fixture.detectChanges();
      expect(explainSpy.calls.mostRecent().args[3]).toBeTrue();
      expect(element.querySelector('.summary')?.textContent).toContain('Colour is the noun');
      expect(element.querySelector('.summary .word')?.textContent).toBe('Colour');
      expect(element.querySelector('.explain')).toBeNull();
    });

    it('offers a guest the sign-in instead, and nothing for words no lexicon entry stands behind', async () => {
      let element = await render(keyed(), null, {text: 'colour vs paint'});
      expect(explainSpy).not.toHaveBeenCalled();
      expect(element.querySelector('.ask a')?.getAttribute('href')).toBe('/auth');
      TestBed.resetTestingModule();
      element = await render(lookupOf([british]), null, {text: 'colour vs paint'});
      expect(element.querySelector('.ask')).toBeNull();
    });

    it('says which word has no entry instead of drawing half a sheet', async () => {
      const element = await render({...lookupOf([]), senses: []}, null, {text: 'colour vs paint'});
      expect(element.querySelector('app-word-comparison .words')).toBeNull();
      expect(element.querySelector('app-word-comparison .missing')?.textContent).toContain('No entry for');
    });

    it('compares "colour or paint" when the lexicon holds both words and not the three as one expression', async () => {
      const element = await render({...lookupOf([british]), senses: []}, null, {text: 'colour or paint'});
      expect(lookupSpy.calls.allArgs().map(args => args[0] as string)).toEqual(['colour or paint', 'colour', 'paint']);
      // Neither word resolved here, so the text is shown as it was looked up.
      expect(element.querySelector('app-word-comparison')).toBeNull();
      TestBed.resetTestingModule();
      const sheet = await render(lookupOf([british]), null, {text: 'colour or paint'});
      expect(lookupSpy.calls.allArgs().map(args => args[0] as string)).toEqual(['colour or paint']);
      expect(sheet.querySelector('.word-sheet')).not.toBeNull();
    });

    it('offers the comparison beside a word the sheet says is mixed up with this one, on the word and on its sense', async () => {
      const lookup = lookupOf([british]);
      const relation = {type: 'confusable', lemma: 'collar', partOfSpeech: 'NOUN', senses: [1]};
      lookup.lexemes = [{index: 1, lemma: 'colour', partOfSpeech: 'NOUN', kind: 'word', grammar: {}, spellings: [], forms: [],
        relations: [relation, {...relation, partOfSpeech: 'VERB'}]}];
      lookup.senses = [{...lookup.senses[0], lexeme: 1}];
      const element = await render(lookup, null);
      const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('.word-facts a.compare'));
      expect(links.length).toBe(1);
      expect(links[0].getAttribute('href')).toContain('text=colour%20vs%20collar');
      const onSense = element.querySelector<HTMLAnchorElement>('.sense a.compare')!;
      expect(onSense.getAttribute('href')).toContain('text=colour%20vs%20collar');
      expect(onSense.getAttribute('href')).toContain('sense=1');
    });
  });

  describe('wrong language profile', () => {
    it('shows the redirected sheet with a notice and switches the active language on click', async () => {
      const redirected = lookupOf([british]);
      redirected.entry = 'word';
      redirected.requestedLanguage = LanguageCode.FR;
      redirected.availableLanguages = [LanguageCode.DE];
      const setCurrentLanguage = jasmine.createSpy('setCurrentLanguage');
      TestBed.configureTestingModule({
        imports: [DiscoverComponent],
        providers: [
          provideRouter([]),
          {provide: ActivatedRoute, useValue: {paramMap: of(convertToParamMap({})), queryParamMap: of(convertToParamMap({text: 'word'}))}},
          {provide: DiscoverService, useValue: {lookup: jasmine.createSpy('lookup').and.returnValue(of(redirected)), suggest: () => of([])}},
          {provide: EntryReportService, useValue: {report: () => of({id: 'r1'})}},
          {provide: CardService, useValue: {createCard: () => of({id: 'c1'}), deleteCard: () => of(void 0), getCardsInLanguage: () => of([])}},
          {provide: TargetLanguageDropdownService, useValue: {currentLanguage$: of(LanguageCode.FR), setCurrentLanguage}},
          {provide: UserInfoService, useValue: {currentUserInfo: {
            learners: [new Learner('l1', LanguageCode.FR, CEFRLevel.A2, true, null), new Learner('l2', LanguageCode.EN, CEFRLevel.B2, true, 'en-GB')],
            fluentLangs: [LanguageCode.UK], activeTargetLangs: [LanguageCode.FR, LanguageCode.EN, LanguageCode.DE], uiPreferences: DEFAULT_UI_PREFERENCES,
          } as unknown as UserInfo}},
        ],
      });
      const localFixture = TestBed.createComponent(DiscoverComponent);
      localFixture.detectChanges();
      await localFixture.whenStable();
      localFixture.detectChanges();
      const element = localFixture.nativeElement as HTMLElement;

      const notice = element.querySelector<HTMLElement>('.correction')!;
      expect(notice.textContent).toContain('Not in French — showing English instead.');
      const buttons = Array.from(notice.querySelectorAll<HTMLButtonElement>('button.correction-action'));
      expect(buttons.map(button => button.textContent?.trim())).toEqual(['Switch to English', 'Read as German']);
      buttons[0].click();
      localFixture.detectChanges();
      expect(setCurrentLanguage).toHaveBeenCalledWith(LanguageCode.EN);
    });

    it('explains when a missed word belongs to the reader’s fluent language or another script', async () => {
      const fluentMiss = lookupOf([]);
      fluentMiss.entry = 'word';
      fluentMiss.language = LanguageCode.FR;
      fluentMiss.senses = [];
      fluentMiss.availableLanguages = [LanguageCode.EN];
      let element = await render(fluentMiss, 'en-GB', {text: 'word'});
      expect(element.querySelector('.empty-sense')?.textContent).toContain('exists in the English dictionary');

      TestBed.resetTestingModule();
      const scriptMiss = lookupOf([]);
      scriptMiss.entry = 'їжак';
      scriptMiss.language = LanguageCode.FR;
      scriptMiss.senses = [];
      scriptMiss.scriptMismatch = true;
      element = await render(scriptMiss, 'en-GB', {text: 'їжак'});
      expect(element.querySelector('.empty-sense')?.textContent).toContain('isn’t written in French');
    });
  });
});
