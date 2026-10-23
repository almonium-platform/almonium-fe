import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {AppConstants} from '../../app.constants';
import {LanguageCode} from '../../models/language.enum';
import {CEFRLevel, Learner, UserInfo} from '../../models/userinfo.model';
import {CardService} from '../../services/card.service';
import {TargetLanguageDropdownService} from '../../services/target-language-dropdown.service';
import {UserInfoService} from '../../services/user-info.service';
import {DiscoverComponent} from './discover.component';
import {DiscoverLookup, DiscoverPronunciation, DiscoverService} from './discover.service';

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

  async function render(lookup: DiscoverLookup, variety: string | null, query: Record<string, string> = {text: 'colour'}): Promise<HTMLElement> {
    const discoverService = jasmine.createSpyObj<DiscoverService>('DiscoverService', ['lookup']);
    discoverService.lookup.and.returnValue(of(lookup));
    const learners = variety === null ? [] : [new Learner('learner-1', LanguageCode.EN, CEFRLevel.B1, true, variety)];
    await TestBed.configureTestingModule({
      imports: [DiscoverComponent],
      providers: [
        provideRouter([]),
        {provide: ActivatedRoute, useValue: {paramMap: of(convertToParamMap({})), queryParamMap: of(convertToParamMap(query))}},
        {provide: DiscoverService, useValue: discoverService},
        {provide: CardService, useValue: jasmine.createSpyObj<CardService>('CardService', ['createCard'])},
        {provide: TargetLanguageDropdownService, useValue: {currentLanguage$: of(LanguageCode.EN), setCurrentLanguage: () => undefined}},
        {provide: UserInfoService, useValue: {currentUserInfo: variety === null ? null : {learners, fluentLangs: [LanguageCode.UK], activeTargetLangs: [LanguageCode.EN]} as unknown as UserInfo}},
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

  it('shows each variety with its IPA and a Listen button only where a clip exists', async () => {
    const element = await render(lookupOf([british, american]), null);
    const rows = pronunciationRows(element);
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('British');
    expect(rows[0].textContent).toContain('[ˈkʌlə]');
    expect(rows[0].querySelector('button.listen')).not.toBeNull();
    expect(rows[0].querySelector('.unverified')).toBeNull();
    expect(rows[1].textContent).toContain('American');
    expect(rows[1].textContent).toContain('[ˈkʌlɚ]');
    expect(rows[1].querySelector('button.listen')).toBeNull();
  });

  it('keeps the server order when the learner has not chosen a variety', async () => {
    const element = await render(lookupOf([british, american, australian]), null);
    expect(pronunciationRows(element).map(row => row.querySelector('.variety')?.textContent?.trim())).toEqual(['British', 'American', 'Australian']);
  });

  it('puts the variety the learner chose for the language first', async () => {
    const element = await render(lookupOf([british, american, australian]), 'en-AU');
    expect(pronunciationRows(element).map(row => row.querySelector('.variety')?.textContent?.trim())).toEqual(['Australian', 'British', 'American']);
  });

  it('marks an unverified clip and still plays it from the API base', async () => {
    const play = spyOn(HTMLMediaElement.prototype, 'play').and.resolveTo();
    const element = await render(lookupOf([australian]), null);
    const row = pronunciationRows(element)[0];
    const mark = row.querySelector<HTMLElement>('.unverified');
    expect(mark?.textContent).toContain('unverified');
    expect(mark?.title).toContain('did not confirm');
    row.querySelector<HTMLButtonElement>('button.listen')!.click();
    expect(play).toHaveBeenCalledTimes(1);
    const audio = play.calls.mostRecent().object as HTMLAudioElement;
    expect(audio.src).toBe(`${AppConstants.API_URL}/public/lexicon/clips/clip-au`);
  });

  it('shows the definition, the level and the examples of the selected sense', async () => {
    const element = await render(lookupOf([british]), null);
    const senses = Array.from(element.querySelectorAll<HTMLElement>('.sense-card'));
    expect(senses[0].querySelector('.definition')?.textContent).toContain('The property of an object');
    expect(senses[0].querySelector('.cefr')?.textContent?.trim()).toBe('A1');
    expect(senses[1].querySelector('.definition')).toBeNull();
    expect(senses[1].querySelector('.cefr')).toBeNull();
    const examples = element.querySelector<HTMLElement>('.examples');
    expect(examples?.textContent).toContain('What colour is it?');
    expect(examples?.textContent).toContain('Якого воно кольору?');
  });

  it('renders a lookup from a backend without lexicon fields the way it did before', async () => {
    const lookup = lookupOf([]);
    lookup.senses = [{index: 1, headword: 'colour', partOfSpeech: 'noun', transcription: 'ˈkʌlə', translations: ['колір'], definition: null, cefr: null, examples: []}];
    const element = await render(lookup, 'en-GB');
    expect(element.querySelector('.pronunciations')).toBeNull();
    expect(element.querySelector('.entry-header .transcription')?.textContent).toContain('[ˈkʌlə]');
    expect(element.querySelector('.examples')).toBeNull();
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
  });
});
