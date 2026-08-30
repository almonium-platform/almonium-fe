import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {combineLatest, of, Subject} from 'rxjs';
import {catchError, switchMap, takeUntil} from 'rxjs/operators';
import {CardDto} from '../../models/card.model';
import {LanguageCode} from '../../models/language.enum';
import {CardService} from '../../services/card.service';
import {LanguageNameService} from '../../services/language-name.service';
import {TargetLanguageDropdownService} from '../../services/target-language-dropdown.service';
import {UserInfoService} from '../../services/user-info.service';

@Component({
  selector: 'app-play',
  templateUrl: './play.component.html',
  imports: [RouterLink],
  styleUrls: ['./play.component.less'],
})
export class PlayComponent implements OnInit, OnDestroy {
  private readonly userInfoService = inject(UserInfoService);
  private readonly languageService = inject(TargetLanguageDropdownService);
  private readonly languageNames = inject(LanguageNameService);
  private readonly cardService = inject(CardService);
  private readonly destroy$ = new Subject<void>();

  protected selectedLanguage = LanguageCode.EN;
  protected cards: CardDto[] = [];
  protected signedIn = false;
  protected loading = true;
  protected loadError = false;

  ngOnInit(): void {
    combineLatest([
      this.userInfoService.loadUserInfo(),
      this.languageService.currentLanguage$,
    ]).pipe(
      switchMap(([user, language]) => {
        this.signedIn = user !== null;
        this.selectedLanguage = language;
        this.loading = this.signedIn;
        this.loadError = false;

        if (!user) {
          return of([] as CardDto[]);
        }

        return this.cardService.getCardsInLanguage(language).pipe(
          catchError(() => {
            this.loadError = true;
            return of([] as CardDto[]);
          }),
        );
      }),
      takeUntil(this.destroy$),
    ).subscribe(cards => {
      this.cards = cards;
      this.loading = false;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected get languageName(): string {
    return this.languageNames.getLanguageName(this.selectedLanguage);
  }

  protected get deckWordCount(): number {
    return this.cards.filter(card => card.activeLearning !== false).length;
  }

  protected get crosswordAction(): string {
    return this.deckWordCount > 0
      ? `Start a ${this.deckWordCount}-word grid`
      : 'Start a grid';
  }
}
