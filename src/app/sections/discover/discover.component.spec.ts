import {TestBed} from '@angular/core/testing';
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

  async function render(lookup: DiscoverLookup, variety: string | null): Promise<HTMLElement> {
    const discoverService = jasmine.createSpyObj<DiscoverService>('DiscoverService', ['lookup']);
    discoverService.lookup.and.returnValue(of(lookup));
    const learners = variety === null ? [] : [new Learner('learner-1', LanguageCode.EN, CEFRLevel.B1, true, variety)];
    await TestBed.configureTestingModule({
      imports: [DiscoverComponent],
      providers: [
        provideRouter([]),
        {provide: ActivatedRoute, useValue: {queryParamMap: of(convertToParamMap({text: 'colour'}))}},
        {provide: DiscoverService, useValue: discoverService},
        {provide: CardService, useValue: jasmine.createSpyObj<CardService>('CardService', ['createCard'])},
        {provide: TargetLanguageDropdownService, useValue: {currentLanguage$: of(LanguageCode.EN)}},
        {provide: UserInfoService, useValue: {currentUserInfo: variety === null ? null : {learners, fluentLangs: [LanguageCode.UK]} as unknown as UserInfo}},
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(DiscoverComponent);
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
});
