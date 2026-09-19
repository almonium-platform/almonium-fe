import {HttpResponse} from '@angular/common/http';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router, convertToParamMap, provideRouter} from '@angular/router';
import {BehaviorSubject, Subject, of} from 'rxjs';

import {PopupTemplateStateService} from '../../../shared/modals/popup-template/popup-template-state.service';
import {UserInfoService} from '../../../services/user-info.service';
import {ProfileSettingsService} from '../../settings/profile/profile-settings.service';
import {DEFAULT_UI_PREFERENCES} from '../../../models/userinfo.model';
import {CardService} from '../../../services/card.service';
import {ParallelModeService} from '../parallel-mode.service';
import {ReadService} from '../read.service';
import {ReaderComponent, sentenceAround} from './reader.component';
import {ReaderDomService} from './reader-dom.service';
import {ReaderProgressTracker} from './reader-progress-tracker.service';

describe('ReaderComponent', () => {
  let fixture: ComponentFixture<ReaderComponent>;
  let baseResponse$: Subject<HttpResponse<ArrayBuffer>>;
  let vocabulary$: Subject<never>;
  const chapters = [
    {id: '01989f47-4c2a-7a10-9e5b-751983624a25', sequence: 11, title: 'CHAPTER V.', analysisStatus: 'complete', cefrEstimate: 'B2', descriptions: ['A long labour ends on a stormy night.']},
    {id: '01989f47-4c2a-7a10-9e5b-751983624a26', sequence: 12, title: 'CHAPTER VI.', analysisStatus: 'complete', cefrEstimate: 'C1', descriptions: ['A letter from Geneva.']},
  ];
  const bookHtml = '<section class="chapter"><h2 class="chapter-title" id="chapter-11">CHAPTER V.</h2><p>It was on a dreary night of November.</p></section>'
    + '<section class="chapter"><h2 class="chapter-title" id="chapter-12">CHAPTER VI.</h2><p>Clerval placed the letter in my hands.</p></section>';

  beforeEach(async () => {
    baseResponse$ = new Subject<HttpResponse<ArrayBuffer>>();
    vocabulary$ = new Subject<never>();

    await TestBed.configureTestingModule({
      imports: [ReaderComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {paramMap: of(convertToParamMap({slug: 'modern-flirtations', sequence: '11'})), snapshot: {queryParamMap: convertToParamMap({})}},
        },
        {
          provide: ReadService,
          useValue: {
            getPublicChapters: () => of(chapters),
            getPublicBook: () => of({
              id: '01989f47-4c2a-7a10-9e5b-751983624a25',
              title: 'Modern Flirtations',
              author: 'Catherine Sinclair',
              language: 'EN',
              cefrLevel: 'B2',
              languageVariants: [],
            }),
            loadPublicBook: () => baseResponse$,
            getChapterVocabulary: () => vocabulary$,
          },
        },
        {provide: CardService, useValue: {getCardsInLanguage: () => of([])}},
        {provide: ParallelModeService, useValue: {mode$: new BehaviorSubject('inline'), setMode: () => undefined}},
        {provide: PopupTemplateStateService, useValue: {open: () => undefined}},
        {provide: UserInfoService, useValue: {currentUserInfo: null}},
        {provide: ProfileSettingsService, useValue: {saveUiPreferences: () => of(undefined)}},
      ],
    })
      .overrideComponent(ReaderComponent, {
        set: {
          providers: [
            ReaderDomService,
            {provide: ReaderProgressTracker, useValue: {startBook: () => null, update: () => undefined, saveOnExit: () => undefined}},
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ReaderComponent);
  });

  function loadBook(): HTMLElement {
    fixture.detectChanges();
    baseResponse$.next(new HttpResponse({status: 200, body: new TextEncoder().encode(bookHtml).buffer}));
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the chapter the route names: a four-line header, its text, and the next chapter after it', () => {
    const host = loadBook();
    expect(host.querySelector('.chapter-head__book')?.textContent).toContain('Modern Flirtations');
    expect(host.querySelector('.chapter-head__place')?.textContent).toContain('Chapter 1 of 2');
    expect(host.querySelector('.chapter-head__place')?.textContent).toContain('Estimated B2');
    expect(host.querySelector('.chapter-head__title')?.textContent).toBe('Chapter V');
    expect(host.querySelector('.chapter-head__description')?.textContent).toContain('A long labour ends');
    expect(host.querySelector('.reader-content')?.textContent).toContain('dreary night');
    expect(host.querySelector('.reader-content')?.textContent).not.toContain('Clerval');
    expect(host.querySelector('.reader-content h2')).toBeNull();
    const next = host.querySelector<HTMLAnchorElement>('.chapter-end__link--next')!;
    expect(next.getAttribute('href')).toBe('/books/modern-flirtations/12');
    expect(next.textContent).toContain('Estimated C1');
    expect(next.textContent).toContain('A letter from Geneva.');
    expect(host.querySelector('.chapter-end__link--previous')).toBeNull();
    expect(host.querySelector('.chapter-end__account')?.textContent).toContain('Your place is kept on this device');
    expect(document.title).toContain('Chapter V — Modern Flirtations (English, B2)');
  });

  it('lists every chapter as a link with its level, describing only the current one', () => {
    const host = loadBook();
    const component = fixture.componentInstance as unknown as {contentsOpen: boolean; cdRef: {markForCheck(): void}};
    component.contentsOpen = true;
    component.cdRef.markForCheck();
    fixture.detectChanges();
    const rows = host.querySelectorAll<HTMLAnchorElement>('.content-map__row');
    expect(rows.length).toBe(2);
    expect(rows[0].classList.contains('is-current')).toBeTrue();
    expect(rows[0].getAttribute('aria-current')).toBe('page');
    expect(rows[1].getAttribute('href')).toBe('/books/modern-flirtations/12');
    expect(rows[1].querySelector('.content-map__level')?.textContent).toBe('C1');
    expect(rows[1].querySelector('.content-map__name')?.textContent).toBe('Chapter VI');
    expect(rows[1].textContent).not.toContain('Estimated');
  });

  it('turns to the next chapter when the arrow is pressed at the end of this one', () => {
    loadBook();
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    const component = fixture.componentInstance as unknown as {isAtScrollBottom: boolean; nextPage(): void; canGoForward: boolean};
    component.isAtScrollBottom = true;
    expect(component.canGoForward).toBeTrue();
    component.nextPage();
    expect(navigate).toHaveBeenCalledWith(['/books', 'modern-flirtations', '12'], {queryParams: {}});
  });

  it('opens a listed word as the card in the rail, with a way back to the list', () => {
    const host = loadBook();
    const component = fixture.componentInstance as unknown as {
      toggleWords(): void; railView: string; openWordFromList(word: unknown): void; railFromWords: boolean;
    };
    component.toggleWords();
    fixture.detectChanges();
    expect(component.railView).toBe('words');
    expect(host.querySelector('.reader-rail app-chapter-vocabulary')).not.toBeNull();
    component.openWordFromList({lemma: 'dreary', surface: 'dreary', context: '…It was on a dreary night.…', blockId: 'c11.p1'});
    fixture.detectChanges();
    expect(component.railView).toBe('card');
    expect(component.railFromWords).toBeTrue();
    expect(host.querySelector('.reader-rail__back')).not.toBeNull();
    expect(host.querySelector('.reader-rail app-chapter-vocabulary')).toBeNull();
  });

  it('selects every sentence of the group on click, on both sides, and clears on a second click or Esc', () => {
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      currentParallelMode: string; isParallelViewActive: boolean;
      readerContentRef: {nativeElement: HTMLElement}; onContentClick(event: Event): void; handleKeyboardEvent(event: KeyboardEvent): void; isLoading: boolean;
    };
    component.isLoading = false;
    const content = document.createElement('div');
    content.className = 'reader-content';
    content.innerHTML = '<p><span data-alignment="11-2-0">One.</span><span data-alignment="11-2-0">Two.</span> Plain. <span data-alignment="11-2-1">Other.</span></p>'
      + '<p><span class="companion-source"><span class="segment"><span data-alignment="11-2-0">Both.</span></span></span></p>';
    component.readerContentRef = {nativeElement: content};
    component.isParallelViewActive = true;
    content.addEventListener('click', event => component.onContentClick(event));
    for (const mode of ['side', 'inline', 'demand']) {
      component.currentParallelMode = mode;
      (content.firstElementChild!.firstElementChild as HTMLElement).click();
      expect(content.querySelectorAll('.is-aligned-current').length).withContext(mode).toBe(3);
      expect(content.querySelector('[data-alignment="11-2-1"]')?.classList.contains('is-aligned-current')).toBeFalse();
      (content.firstElementChild!.firstElementChild as HTMLElement).click();
      expect(content.querySelectorAll('.is-aligned-current').length).withContext(`${mode} again`).toBe(0);
    }
    (content.firstElementChild!.firstElementChild as HTMLElement).click();
    expect(content.querySelectorAll('.is-aligned-current').length).toBe(3);
    component.handleKeyboardEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    expect(content.querySelectorAll('.is-aligned-current').length).toBe(0);
    const selection = window.getSelection()!;
    const range = document.createRange();
    document.body.appendChild(content);
    (content.firstElementChild!.firstElementChild as HTMLElement).click();
    range.selectNodeContents(content.querySelector('[data-alignment="11-2-1"]')!);
    selection.addRange(range);
    content.querySelector<HTMLElement>('[data-alignment="11-2-1"]')!.click();
    expect(content.querySelectorAll('.is-aligned-current').length).toBe(3);
    selection.removeAllRanges();
    content.remove();
  });

  it('keeps a guest\'s sentence-pairs switch for the visit and a member\'s on the account', () => {
    fixture.detectChanges();
    const userInfo = TestBed.inject(UserInfoService) as unknown as {currentUserInfo: unknown; updateUserInfo?: jasmine.Spy};
    const profileSettings = TestBed.inject(ProfileSettingsService);
    const save = spyOn(profileSettings, 'saveUiPreferences').and.returnValue(of(undefined));
    const component = fixture.componentInstance as unknown as {showPairs: boolean; toggleShowPairs(): void};
    expect(component.showPairs).toBeFalse();
    component.toggleShowPairs();
    expect(component.showPairs).toBeTrue();
    expect(save).not.toHaveBeenCalled();

    const preferences = structuredClone(DEFAULT_UI_PREFERENCES);
    userInfo.currentUserInfo = {uiPreferences: preferences};
    userInfo.updateUserInfo = jasmine.createSpy('updateUserInfo');
    component.toggleShowPairs();
    expect(component.showPairs).toBeFalse();
    expect(userInfo.updateUserInfo).toHaveBeenCalledWith({uiPreferences: jasmine.objectContaining({reader: {showPairs: false}})});
    expect(save).toHaveBeenCalledWith(jasmine.objectContaining({reader: {showPairs: false}, navbar: preferences.navbar}));
    // The stored preferences are not mutated in place: the copy carries the change.
    expect(preferences.reader.showPairs).toBeFalse();
    component.toggleShowPairs();
    expect(save).toHaveBeenCalledWith(jasmine.objectContaining({reader: {showPairs: true}}));
  });

  it('opens one companion block under the paragraph in on-demand mode and closes it with the selection', () => {
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      currentParallelMode: string; isParallelViewActive: boolean;
      readerContentRef: {nativeElement: HTMLElement}; onContentClick(event: Event): void; clearSelection(): boolean;
    };
    const content = document.createElement('div');
    content.innerHTML = '<p><span class="segment" data-pair="0"><span data-alignment="11-2-0">One.</span> <span data-alignment="11-2-1">Two.</span></span>'
      + '<span class="companion-source"><span class="segment" lang="uk"><span data-alignment="11-2-0">Раз.</span> <span data-alignment="11-2-1">Два.</span></span></span></p>';
    component.readerContentRef = {nativeElement: content};
    component.isParallelViewActive = true;
    component.currentParallelMode = 'demand';
    content.addEventListener('click', event => component.onContentClick(event));
    content.querySelector<HTMLElement>('[data-alignment="11-2-0"]')!.click();
    expect(content.querySelector('[data-alignment="11-2-0"] + .companion-block')?.textContent).toBe('Раз.');
    content.querySelector<HTMLElement>('[data-alignment="11-2-1"]')!.click();
    expect(content.querySelectorAll('.companion-block').length).toBe(1);
    expect(content.querySelector('.companion-block')?.textContent).toBe('Два.');
    expect(component.clearSelection()).toBeTrue();
    expect(content.querySelector('.companion-block')).toBeNull();
    expect(component.clearSelection()).toBeFalse();
  });
});

describe('sentenceAround', () => {
  it('offers original-derived translations honestly and lets readers hide them', () => {
    interface Variant {editionSlug: string; editionType: string; language?: string; sourceEditionSlug?: string}
    const component = Object.create(ReaderComponent.prototype) as {
      primaryEdition: Variant; parallelVersions: Variant[]; includeOtherEditionTranslations: boolean;
      companionSlug: string | null; selectOption: jasmine.Spy;
      hasOtherEditionTranslations: boolean; availableEditions: Variant[];
      editionLabel(edition: Variant): string; toggleOtherEditionTranslations(): void;
    };
    component.primaryEdition = {editionSlug: 'b2', editionType: 'adaptation'};
    const original = {editionSlug: 'original', editionType: 'original', language: 'EN'};
    const inherited = {editionSlug: 'uk', editionType: 'machine_translation', sourceEditionSlug: 'original', language: 'UK'};
    const direct = {editionSlug: 'b2-uk', editionType: 'machine_translation', sourceEditionSlug: 'b2', language: 'UK'};
    component.parallelVersions = [original, inherited, direct];
    component.includeOtherEditionTranslations = true;
    component.companionSlug = 'uk';
    component.selectOption = jasmine.createSpy();
    expect(component.hasOtherEditionTranslations).toBeTrue();
    expect(component.editionLabel(inherited)).toContain('not this adaptation');
    component.toggleOtherEditionTranslations();
    expect(component.availableEditions).toEqual([original, direct]);
    expect(component.selectOption).toHaveBeenCalledWith(null);
    component.toggleOtherEditionTranslations();
    component.companionSlug = null;
    expect(component.availableEditions).toEqual([original, inherited, direct]);
  });

  it('cuts the paragraph to the sentence that holds the word', () => {
    const paragraph = 'It was late. The Publishers of the Standard Novels expressed a wish. I complied, gladly.';
    expect(sentenceAround(paragraph, 'Publishers')).toBe('The Publishers of the Standard Novels expressed a wish.');
  });

  it('keeps a closing quotation mark with its sentence', () => {
    const paragraph = 'He said "go home." She stayed.';
    expect(sentenceAround(paragraph, 'home')).toBe('He said "go home."');
  });

  it('returns the whole paragraph when the word is not in it', () => {
    expect(sentenceAround('One. Two.', 'three')).toBe('One. Two.');
  });
});
