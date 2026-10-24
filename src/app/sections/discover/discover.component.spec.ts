import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {AppConstants} from '../../app.constants';
import {LanguageCode} from '../../models/language.enum';
import {CEFRLevel, DEFAULT_UI_PREFERENCES, Learner, UserInfo} from '../../models/userinfo.model';
import {CardService} from '../../services/card.service';
import {TargetLanguageDropdownService} from '../../services/target-language-dropdown.service';
import {UserInfoService} from '../../services/user-info.service';
import {DiscoverComponent} from './discover.component';
import {DiscoverLookup, DiscoverPronunciation, DiscoverService, DiscoverSuggestion} from './discover.service';

describe('DiscoverComponent', () => {
  const british: DiscoverPronunciation = {variety: 'en-GB', ipa: 'ˈkʌlə', clipUrl: '/public/lexicon/clips/clip-gb', clipStatus: 'verified'};
  const american: DiscoverPronunciation = {variety: 'en-US', ipa: 'ˈkʌlɚ', clipUrl: null, clipStatus: null};
  const australian: DiscoverPronunciation = {variety: 'en-AU', ipa: 'ˈkalə', clipUrl: '/public/lexicon/clips/clip-au', clipStatus: 'unverified'};

  function lookupOf(pronunciations: DiscoverPronunciation[]): DiscoverLookup {
    return {
      entry: 'colour', sourceContext: null, language: LanguageCode.EN, translationLanguage: LanguageCode.UK, provider: 'lexicon',
      frequency: null, pronunciations,
      senses: [
        {
          index: 1, headword: 'colour', partOfSpeech: 'noun', transcription: null, translations: ['колір'],
          definition: 'The property of an object that depends on the light it reflects.', cefr: 'A1',
          examples: [{text: 'What colour is it?', translation: 'Якого воно кольору?'}],
        },
        {index: 2, headword: 'colour', partOfSpeech: 'verb', transcription: null, translations: ['фарбувати'], definition: null, cefr: null, examples: []},
      ],
    };
  }

  let fixture: ComponentFixture<DiscoverComponent>;
  let lookupSpy: jasmine.Spy;
  let suggestSpy: jasmine.Spy;
  const SUGGESTIONS: DiscoverSuggestion[] = [
    {headword: 'Ausgabe', partOfSpeech: 'NOUN', gender: 'Fem', gloss: 'edition'},
    {headword: 'ausgehen', partOfSpeech: 'VERB', gender: null, gloss: 'go out'},
    {headword: 'Ausgang', partOfSpeech: 'NOUN', gender: 'Masc', gloss: null},
  ];

  async function render(lookup: DiscoverLookup, variety: string | null, query: Record<string, string> = {text: 'colour'}): Promise<HTMLElement> {
    lookupSpy = jasmine.createSpy('lookup').and.returnValue(of(lookup));
    suggestSpy = jasmine.createSpy('suggest').and.returnValue(of(SUGGESTIONS));
    const discoverService = {lookup: lookupSpy, suggest: suggestSpy};
    const learners = variety === null ? [] : [new Learner('learner-1', LanguageCode.EN, CEFRLevel.B1, true, variety)];
    await TestBed.configureTestingModule({
      imports: [DiscoverComponent],
      providers: [
        provideRouter([]),
        {provide: ActivatedRoute, useValue: {paramMap: of(convertToParamMap({})), queryParamMap: of(convertToParamMap(query))}},
        {provide: DiscoverService, useValue: discoverService},
        {provide: CardService, useValue: {createCard: jasmine.createSpy('createCard'), deleteCard: jasmine.createSpy('deleteCard'), getCardsInLanguage: () => of([])}},
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
    return Array.from(element.querySelectorAll<HTMLElement>('.pronunciations li'));
  }

  it('shows each variety with its IPA and a speaker for every one', async () => {
    const element = await render(lookupOf([british, american]), null);
    const rows = pronunciationRows(element);
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('British');
    expect(rows[0].textContent).toContain('ˈkʌlə');
    expect(rows[0].querySelector('button.speaker')?.getAttribute('aria-label')).toBe('Play the British pronunciation');
    expect(rows[0].querySelector('.unverified')).toBeNull();
    expect(rows[1].textContent).toContain('American');
    expect(rows[1].querySelector('button.speaker')).not.toBeNull();
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
      ...[1, 2, 3, 4].map(index => ({index, headword: 'colour', partOfSpeech: 'NOUN', transcription: null, translations: [`n${index}`], definition: null, cefr: null, examples: []})),
      {index: 5, headword: 'colour', partOfSpeech: 'VERB', transcription: null, translations: ['v'], definition: null, cefr: null, examples: []},
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
    lookup.senses = [{index: 1, headword: 'colour', partOfSpeech: 'noun', transcription: 'ˈkʌlə', translations: ['колір'], definition: null, cefr: null, examples: []}];
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
});
