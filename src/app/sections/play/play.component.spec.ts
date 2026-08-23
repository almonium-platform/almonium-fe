import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {CardDto} from '../../models/card.model';
import {LanguageCode} from '../../models/language.enum';
import {UserInfo} from '../../models/userinfo.model';
import {CardService} from '../../services/card.service';
import {TargetLanguageDropdownService} from '../../services/target-language-dropdown.service';
import {UserInfoService} from '../../services/user-info.service';
import {PlayComponent} from './play.component';

describe('PlayComponent', () => {
  it('personalizes the page with the active words in the selected language', async () => {
    const cards: CardDto[] = [
      {entry: 'eins', language: 'DE', translations: [], activeLearning: true},
      {entry: 'zwei', language: 'DE', translations: []},
      {entry: 'drei', language: 'DE', translations: [], activeLearning: false},
    ];
    const cardService = jasmine.createSpyObj<CardService>('CardService', ['getCardsInLanguage']);
    cardService.getCardsInLanguage.and.returnValue(of(cards));

    await TestBed.configureTestingModule({
      imports: [PlayComponent],
      providers: [
        provideRouter([]),
        {provide: CardService, useValue: cardService},
        {
          provide: TargetLanguageDropdownService,
          useValue: {currentLanguage$: of(LanguageCode.DE)},
        },
        {
          provide: UserInfoService,
          useValue: {loadUserInfo: () => of({} as UserInfo)},
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PlayComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(cardService.getCardsInLanguage.calls.mostRecent().args[0]).toBe(LanguageCode.DE);
    expect(element.querySelector('h1')?.textContent).toContain('same 2 words');
    expect(element.querySelector('.primary-action')?.textContent).toContain('Start a 2-word grid');
    expect(element.textContent).toContain('German vocabulary');
  });
});
