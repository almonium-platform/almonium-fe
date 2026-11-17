import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {LanguageCode} from '../../../models/language.enum';
import {UserInfo} from '../../../models/userinfo.model';
import {CardService} from '../../../services/card.service';
import {LanguageNameService} from '../../../services/language-name.service';
import {UserInfoService} from '../../../services/user-info.service';
import {DiscoverLookup, DiscoverService} from '../../discover/discover.service';
import {EntryReportService} from '../../discover/report/entry-report.service';
import {WordCardComponent} from './word-card.component';

describe('WordCardComponent', () => {
  const lookup: DiscoverLookup = {
    entry: 'Bank', sourceContext: null, language: LanguageCode.DE, translationLanguage: LanguageCode.EN, provider: 'lexicon',
    frequency: null, pronunciations: [], homophones: [],
    senses: [
      {index: 1, key: 'key-1', headword: 'Bank', partOfSpeech: 'noun', transcription: null, translations: ['bench'], definition: null, cefr: null, examples: []},
      {index: 2, key: 'key-2', headword: 'Bank', partOfSpeech: 'noun', transcription: null, translations: ['bank'], definition: null, cefr: null, examples: []},
    ],
  };

  let fixture: ComponentFixture<WordCardComponent>;
  let reportSpy: jasmine.Spy;

  function render(signedIn: boolean): HTMLElement {
    reportSpy = jasmine.createSpy('report').and.returnValue(of({id: 'report-1'}));
    TestBed.configureTestingModule({
      imports: [WordCardComponent],
      providers: [
        provideRouter([]),
        {provide: DiscoverService, useValue: {lookup: () => of(lookup)}},
        {provide: EntryReportService, useValue: {report: reportSpy}},
        {provide: CardService, useValue: {createCard: () => of({})}},
        {provide: LanguageNameService, useValue: {getLanguageName: () => 'German'}},
        {provide: UserInfoService, useValue: {currentUserInfo: signedIn ? {} as UserInfo : null}},
      ],
    });
    fixture = TestBed.createComponent(WordCardComponent);
    fixture.componentRef.setInput('entry', 'Bank');
    fixture.componentRef.setInput('context', 'Er sitzt auf der Bank.');
    fixture.componentRef.setInput('language', LanguageCode.DE);
    fixture.componentRef.setInput('translationLanguage', LanguageCode.EN);
    fixture.componentRef.setInput('bookSlug', 'kafka-de');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('flags a sense with its key, the sentence met and the book', () => {
    const element = render(true);
    const flags = element.querySelectorAll<HTMLButtonElement>('.plate__senses .plate__flag');
    expect(flags.length).toBe(2);
    flags[0].click();
    fixture.detectChanges();
    const panel = element.querySelector<HTMLElement>('.plate__senses app-entry-report')!;
    panel.querySelectorAll<HTMLInputElement>('input[type=radio]')[0].click();
    fixture.detectChanges();
    panel.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    expect(reportSpy).toHaveBeenCalledWith({
      language: LanguageCode.DE, headword: 'Bank', senseKey: 'key-1', reason: 'WRONG_SENSE', comment: null,
      context: 'Er sitzt auf der Bank.', book: 'kafka-de',
    });
  });

  it('offers no flag to a guest', () => {
    const element = render(false);
    expect(element.querySelector('.plate__flag')).toBeNull();
  });
});
