import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {forkJoin, of, Subject} from 'rxjs';
import {catchError, switchMap, takeUntil} from 'rxjs/operators';
import {CardDto} from '../../models/card.model';
import {LanguageCode} from '../../models/language.enum';
import {SetupStep, UserInfo} from '../../models/userinfo.model';
import {CardService} from '../../services/card.service';
import {LanguageNameService} from '../../services/language-name.service';
import {TargetLanguageDropdownService} from '../../services/target-language-dropdown.service';
import {UserInfoService} from '../../services/user-info.service';
import {BookCoverComponent} from '../read/book-cover/book-cover.component';
import {Book, BookshelfView} from '../read/book.model';
import {ReadService} from '../read/read.service';
import {ReviewService} from '../review/review.service';
import {HarnessComponent} from '../../shared/rhythm/harness/harness.component';

const EMPTY_SHELF: BookshelfView = {continueReading: [], available: [], favorites: []};

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.less'],
  imports: [RouterLink, BookCoverComponent, HarnessComponent],
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly userService = inject(UserInfoService);
  private readonly languageService = inject(TargetLanguageDropdownService);
  private readonly readService = inject(ReadService);
  private readonly cardService = inject(CardService);
  private readonly languageNameService = inject(LanguageNameService);
  private readonly reviewService = inject(ReviewService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  protected userInfo: UserInfo | null = null;
  protected selectedLanguage = LanguageCode.EN;
  protected shelf: BookshelfView = EMPTY_SHELF;
  protected cards: CardDto[] = [];
  protected loading = true;
  protected loadError = false;
  protected reviewDueCount = 0;
  protected readonly today = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  ngOnInit(): void {
    this.userService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe(info => {
      this.userInfo = info;
      if (info && info.setupStep !== SetupStep.COMPLETED) {
        void this.router.navigate(['/onboarding']);
      }
    });

    this.languageService.currentLanguage$.pipe(
      switchMap(language => {
        this.selectedLanguage = language;
        this.loading = true;
        this.loadError = false;
        return forkJoin({
          shelf: this.readService.getBooksForLang(language, false).pipe(
            catchError(() => {
              this.loadError = true;
              return of(EMPTY_SHELF);
            }),
          ),
          cards: this.cardService.getCardsInLanguage(language).pipe(
            catchError(() => {
              this.loadError = true;
              return of([] as CardDto[]);
            }),
          ),
          review: this.reviewService.getSummary(language).pipe(
            catchError(() => {
              this.loadError = true;
              return of(null);
            }),
          ),
        });
      }),
      takeUntil(this.destroy$),
    ).subscribe(({shelf, cards, review}) => {
      this.shelf = shelf;
      this.cards = cards;
      this.reviewDueCount = review?.dueCount ?? 0;
      this.loading = false;
    });

    this.userService.loadUserInfo().pipe(takeUntil(this.destroy$)).subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected get continueBook(): Book | null {
    return this.shelf.continueReading[0] ?? null;
  }

  protected get hasHomeActivity(): boolean {
    return this.shelf.continueReading.length > 0 || this.cards.length > 0;
  }

  protected get recentCards(): CardDto[] {
    return [...this.cards]
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      .slice(0, 4);
  }

  protected get reviewCount(): number {
    return this.reviewDueCount;
  }

  protected get shelfBooks(): Book[] {
    const unique = new Map<string, Book>();
    [...this.shelf.continueReading, ...this.shelf.favorites].forEach(book => unique.set(book.id, book));
    return [...unique.values()].slice(0, 4);
  }

  protected get suggestedBooks(): Book[] {
    return this.shelf.available.slice(0, 3);
  }

  protected get languageName(): string {
    return this.languageNameService.getLanguageName(this.selectedLanguage);
  }

  protected get learnerLevel(): string | null {
    return this.userInfo?.learners.find(learner => learner.language === this.selectedLanguage)?.selfReportedLevel ?? null;
  }

  protected translation(card: CardDto): string {
    return card.translations[0]?.translation ?? 'Translation not added yet';
  }

  protected cardMeta(card: CardDto): string {
    const details: string[] = [];
    if (card.tags?.[0]?.text) details.push(card.tags[0].text);
    if (card.iteration) details.push(`reviewed ${card.iteration} ${card.iteration === 1 ? 'time' : 'times'}`);
    return details.join(' · ') || 'saved vocabulary';
  }

  protected example(card: CardDto): string | null {
    return card.examples?.[0]?.example ?? null;
  }

  protected progressLabel(book: Book): string {
    const progress = book.progressPercentage ?? 0;
    if (progress >= 90) return 'Almost finished';
    if (progress >= 50) return 'Well underway';
    return 'Your place is saved';
  }
}
