import {HttpErrorResponse} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {BehaviorSubject, Observable, of, throwError} from 'rxjs';
import {CEFRLevel} from '../../../models/userinfo.model';
import {LanguageCode} from '../../../models/language.enum';
import {SupportedLanguagesService} from '../../../services/supported-langs.service';
import {UserInfoService} from '../../../services/user-info.service';
import {AppHttpError} from '../../../shared/app-http-error';
import {PopupTemplateStateService} from '../../../shared/modals/popup-template/popup-template-state.service';
import {PageSeoService} from '../../../shared/seo/page-seo.service';
import {Book} from '../book.model';
import {ReadService} from '../read.service';
import {BookComponent} from './book.component';

describe('BookComponent', () => {
  const book: Book = {
    id: '01989f47-4c2a-7a10-9e5b-751983624a25', editionSlug: 'dracula-original-en', workSlug: 'dracula', title: 'Dracula',
    author: 'Bram Stoker', description: '', publicationYear: 1897, coverUrl: null, wordCount: 160000, language: LanguageCode.EN,
    cefrLevel: CEFRLevel.C1, progressPercentage: null, currentChapter: null, chapterCount: null, isTranslation: false,
    hasParallelTranslation: false, hasTranslation: false, languageVariants: [], favorite: false,
  };

  function setup(getPublicBook: () => Observable<Book>) {
    const open = jasmine.createSpy('open').and.returnValue(of(undefined));
    const popupOpen = jasmine.createSpy('popupOpen');
    TestBed.configureTestingModule({
      imports: [BookComponent],
      providers: [
        provideRouter([]),
        {provide: ActivatedRoute, useValue: {paramMap: of(convertToParamMap({slug: book.editionSlug}))}},
        {provide: ReadService, useValue: {getPublicBook, getPublicChapters: () => of([])}},
        {provide: UserInfoService, useValue: {currentUserInfo: null}},
        {provide: SupportedLanguagesService, useValue: {supportedLanguages$: new BehaviorSubject(null)}},
        {provide: PageSeoService, useValue: {describe: () => undefined, clear: () => undefined}},
        {provide: PopupTemplateStateService, useValue: {open: popupOpen, close: () => undefined}},
        {provide: TuiNotificationService, useValue: {open}},
      ],
    });
    const fixture = TestBed.createComponent(BookComponent);
    fixture.detectChanges();
    return {fixture, host: fixture.nativeElement as HTMLElement, open, popupOpen};
  }

  it('shows a book its country may not open as a plain page, not an error toast', () => {
    const blocked = new AppHttpError(new HttpErrorResponse({status: 451, error: {success: false, message: 'This book isn’t available in your country.'}}));
    const {host, open} = setup(() => throwError(() => blocked));
    expect(host.querySelector('app-unavailable-in-country')?.textContent).toContain('This book isn’t available in your country');
    expect(host.textContent).toContain('Copyright lasts longer in some countries than others');
    expect(host.querySelector('.book-card')).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it('still says when the book failed to load for any other reason', () => {
    const {host, open} = setup(() => throwError(() => new AppHttpError(new HttpErrorResponse({status: 500}))));
    expect(host.querySelector('app-unavailable-in-country')).toBeNull();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('offers the report button quietly at the foot of the book, to guests too', () => {
    const {host, popupOpen} = setup(() => of(book));
    const link = host.querySelector<HTMLButtonElement>('.rights-line__link')!;
    expect(link.textContent).toContain('Report a problem with this book’s rights');
    link.click();
    expect(popupOpen).toHaveBeenCalledOnceWith(jasmine.anything(), 'rights-report');
  });
});
