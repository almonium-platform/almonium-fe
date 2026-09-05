import {logger} from '../../../shared/logger';
import {getErrorMessage} from '../../../shared/http-error';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {Meta, Title} from '@angular/platform-browser';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {HttpErrorResponse} from '@angular/common/http';
import {AsyncPipe} from '@angular/common';
import {BehaviorSubject, finalize, forkJoin, of, switchMap} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {AvatarComponent} from '../../../shared/avatar/avatar.component';
import {SharedWordComponent} from '../shared-word/shared-word.component';
import {SharedFooterComponent} from '../shared-footer/shared-footer.component';
import {DeadLinkComponent} from '../dead-link/dead-link.component';
import {DeckShareSheetComponent} from '../deck-share-sheet/deck-share-sheet.component';
import {SharedLinkService} from '../shared-link.service';
import {AddedWordsResult, Deck, SharedDeckView, SharedLinkViewerStatus, SharedWord} from '../shared-link.model';
import {UserInfoService} from '../../../services/user-info.service';
import {LanguageNameService} from '../../../services/language-name.service';
import {LanguageApiService} from '../../../services/language-api.service';
import {ReturnPathService} from '../../../services/return-path.service';
import {PopupTemplateStateService} from '../../../shared/modals/popup-template/popup-template-state.service';
import {CEFRLevel, SetupStep, UserInfo} from '../../../models/userinfo.model';
import {capitalise, wordsAsLabel, wordsInProse} from '../count-words';
import {languageBadgeFill, ordinalInWords} from '../language-badge';

/** The one panel that takes the Add button's place, chosen by who is looking and what they already hold. */
type DeckPanel =
  | 'none'
  | 'sign-up'
  | 'select'
  | 'all-held'
  | 'owner'
  | 'empty'
  | 'free-wrong-language'
  | 'add-language'
  | 'language-added';

/**
 * A deck opened from a link. One route, three viewers: a stranger with no account, a signed-in learner on the same
 * language, and a signed-in learner on a different one. Everything the stranger sees, the others see too; the
 * signed-in additions are the checkbox column, the selection bar and one primary button.
 */
@Component({
  selector: 'app-shared-deck',
  templateUrl: './shared-deck.component.html',
  styleUrls: ['./shared-deck.component.less'],
  imports: [RouterLink, AsyncPipe, AvatarComponent, SharedWordComponent, SharedFooterComponent, DeadLinkComponent, DeckShareSheetComponent],
})
export class SharedDeckComponent implements OnInit, AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sharedLinkService = inject(SharedLinkService);
  private userInfoService = inject(UserInfoService);
  private languageNameService = inject(LanguageNameService);
  private languageApiService = inject(LanguageApiService);
  private returnPath = inject(ReturnPathService);
  private popupTemplateStateService = inject(PopupTemplateStateService);
  private alertService = inject(TuiNotificationService);
  private pageTitle = inject(Title);
  private meta = inject(Meta);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  @ViewChild(DeckShareSheetComponent) shareSheet?: DeckShareSheetComponent;
  @ViewChildren('wordRow') wordRows?: QueryList<ElementRef<HTMLElement>>;

  protected shareId = '';
  protected view: SharedDeckView | null = null;
  protected viewer: SharedLinkViewerStatus | null = null;
  protected userInfo: UserInfo | null = null;
  protected sessionChecked = false;
  protected loading = true;
  protected loadError: string | null = null;
  protected ownDeck: Deck | null = null;

  protected selected = new Set<string>();
  protected readonly adding$ = new BehaviorSubject(false);
  protected lastAdded: AddedWordsResult | null = null;
  protected languageAdded = false;

  /** Phone only: the sign-up bar pins to the bottom once the first row has scrolled past. */
  protected showStickyAsk = false;
  private rowObserver: IntersectionObserver | null = null;
  private readonly narrow = window.matchMedia('(max-width: 40rem)');

  ngOnInit(): void {
    this.meta.updateTag({name: 'robots', content: 'noindex'});
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.shareId = params.get('id') ?? '';
      this.load();
    });
  }

  ngAfterViewInit(): void {
    this.wordRows?.changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.watchFirstRow());
  }

  ngOnDestroy(): void {
    this.meta.removeTag("name='robots'");
    this.rowObserver?.disconnect();
  }

  private load(): void {
    this.loading = true;
    this.loadError = null;
    forkJoin({
      view: this.sharedLinkService.getDeck(this.shareId),
      user: this.userInfoService.loadUserInfo().pipe(catchError(() => of(null))),
    }).pipe(
      switchMap(({view, user}) => {
        this.view = view;
        this.userInfo = user;
        this.sessionChecked = true;
        this.setTitle();
        if (user && this.returnPath.peek() === this.router.url) this.returnPath.consume();
        if (user && user.setupStep !== SetupStep.COMPLETED) {
          this.returnPath.remember(this.router.url);
          void this.router.navigate(['/onboarding']);
          return of(null);
        }
        if (!user || view.status !== 'ACTIVE') return of(null);
        return this.sharedLinkService.deckViewer(this.shareId);
      }),
      finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
        this.watchFirstRow();
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: viewer => this.applyViewer(viewer),
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          void this.router.navigate(['/404'], {skipLocationChange: true});
          return;
        }
        logger.error('Could not open the shared deck', error);
        this.loadError = getErrorMessage(error, 'The deck could not be opened. Please try again.');
      },
    });
  }

  private applyViewer(viewer: SharedLinkViewerStatus | null): void {
    this.viewer = viewer;
    if (viewer?.owner) this.loadOwnDeck();
    this.selected = new Set(this.addableIds);
    this.cdr.detectChanges();
  }

  private loadOwnDeck(): void {
    this.sharedLinkService.myDecks().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: decks => {
        this.ownDeck = decks.find(deck => deck.shareId === this.shareId) ?? null;
        this.cdr.detectChanges();
      },
      error: (error: unknown) => logger.error('Could not load own decks', error),
    });
  }

  private setTitle(): void {
    const title = this.view?.title;
    this.pageTitle.setTitle(title ? `${title} · Shared deck | Almonium` : 'Shared deck | Almonium');
  }

  // --- what the page shows -------------------------------------------------------------------------

  get words(): SharedWord[] {
    return this.view?.words ?? [];
  }

  get languageName(): string {
    return this.languageNameService.getLanguageName(this.view?.language);
  }

  get badgeFill(): string {
    return languageBadgeFill(this.view?.language ?? '');
  }

  get signedIn(): boolean {
    return !!this.userInfo;
  }

  /** "Twenty-four words in German." - prose, so the count is spelled out. */
  get subhead(): string {
    const count = this.words.length;
    if (count === 0) return '';
    return `${capitalise(wordsInProse(count))} in ${this.languageName}.`;
  }

  get heldIds(): Set<string> {
    return new Set(this.viewer?.heldWordIds ?? []);
  }

  get addableIds(): string[] {
    const held = this.heldIds;
    return this.words.map(word => word.id).filter(id => !held.has(id));
  }

  get canSelect(): boolean {
    return this.panel === 'select';
  }

  /** Held rows are marked for a learner comparing the deck with their own words; the owner sees the deck plain. */
  get showHeldMarks(): boolean {
    return this.panel === 'select' || this.panel === 'all-held';
  }

  get panel(): DeckPanel {
    if (this.view?.status !== 'ACTIVE') return 'none';
    if (!this.signedIn) return this.words.length === 0 ? 'empty' : 'sign-up';
    if (!this.viewer) return 'none';
    if (this.viewer.owner) return 'owner';
    if (this.words.length === 0) return 'empty';
    if (this.languageAdded) return 'language-added';
    if (!this.viewer.hasLearner) return this.userInfo?.premium ? 'add-language' : 'free-wrong-language';
    if (this.addableIds.length === 0) return 'all-held';
    return 'select';
  }

  get addLabel(): string {
    const count = this.selected.size;
    return count === 0 ? 'Add words' : `Add ${wordsAsLabel(count)}`;
  }

  get selectionSummary(): string {
    return `${this.selected.size} of ${this.words.length} selected`;
  }

  get heldSummary(): string | null {
    const held = this.heldIds.size;
    if (held === 0) return null;
    return held === 1 ? '1 is already in your words' : `${held} are already in your words`;
  }

  get dueNote(): string {
    const due = this.viewer?.dueAmongHeld ?? 0;
    if (due === 0) return 'none are due yet';
    return due === 1 ? 'one is due' : `${wordsInProse(due).replace(/ words?$/, '')} are due`;
  }

  get allHeldLine(): string {
    return `All ${wordsInProse(this.words.length).replace(/ words?$/, '')} are in your words.`;
  }

  get viewerLanguageName(): string {
    const active = this.userInfo?.activeTargetLangs[0] ?? this.userInfo?.targetLangs[0];
    return this.languageNameService.getLanguageName(active);
  }

  get languageOrdinal(): string {
    return ordinalInWords((this.userInfo?.targetLangs.length ?? 0) + 1);
  }

  get addLanguageLabel(): string {
    return `Add ${this.languageName}, then ${wordsAsLabel(this.words.length)}`;
  }

  /** "Twenty-four words, scheduled" - the sign-up card names the payload rather than the product. */
  get signUpHeading(): string {
    return `${capitalise(wordsInProse(this.words.length))}, scheduled`;
  }

  get wrongLanguageLead(): string {
    const count = this.words.length;
    return count === 1
      ? `This word is ${this.languageName}.`
      : `These ${wordsInProse(count)} are ${this.languageName}.`;
  }

  get languageAddedLine(): string {
    const added = this.lastAdded?.added ?? 0;
    if (added === 0) return `${this.languageName} added. Nothing new went into its queue.`;
    return `${this.languageName} added. ${capitalise(wordsInProse(added))} ${added === 1 ? 'is' : 'are'} in its queue.`;
  }

  get addedLine(): string {
    return `Added. ${(this.lastAdded?.added ?? 0) === 1 ? 'It is' : 'They are'} due tomorrow.`;
  }

  get sharerProfileLink(): string | null {
    const username = this.view?.sharer?.username;
    return this.signedIn && username ? `/users/${username}` : null;
  }

  isHeld(word: SharedWord): boolean {
    return this.heldIds.has(word.id);
  }

  isSelected(word: SharedWord): boolean {
    return this.selected.has(word.id);
  }

  // --- what the viewer can do ----------------------------------------------------------------------

  toggle(word: SharedWord): void {
    if (this.isHeld(word) || !this.canSelect) return;
    if (this.selected.has(word.id)) this.selected.delete(word.id);
    else this.selected.add(word.id);
  }

  selectAll(): void {
    this.selected = new Set(this.addableIds);
  }

  clearSelection(): void {
    this.selected = new Set();
  }

  /** At zero the button stays live: it marks the list and moves focus to the first row rather than sitting disabled. */
  add(): void {
    if (this.selected.size === 0) {
      this.selectAll();
      this.wordRows?.first?.nativeElement.focus();
      return;
    }
    this.adding$.next(true);
    this.sharedLinkService.addFromDeck(this.shareId, [...this.selected])
      .pipe(
        switchMap(result => {
          this.lastAdded = result;
          return this.sharedLinkService.deckViewer(this.shareId);
        }),
        finalize(() => this.adding$.next(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: viewer => this.applyViewer(viewer),
        error: (error: unknown) => this.alertService
          .open(getErrorMessage(error, 'The words could not be added. Please try again.'), {appearance: 'negative'})
          .subscribe(),
      });
  }

  /** One button does both steps: the language, then every word, because two clicks for one intention is the thing to avoid. */
  addLanguageThenWords(): void {
    const language = this.view?.language;
    if (!language) return;
    this.adding$.next(true);
    this.languageApiService.setupLanguages([{language, cefrLevel: CEFRLevel.A1}])
      .pipe(
        switchMap(() => this.userInfoService.fetchUserInfoFromServer()),
        switchMap(user => {
          this.userInfo = user;
          return this.sharedLinkService.addFromDeck(this.shareId, this.words.map(word => word.id));
        }),
        switchMap(result => {
          this.lastAdded = result;
          return this.sharedLinkService.deckViewer(this.shareId);
        }),
        finalize(() => this.adding$.next(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: viewer => {
          this.languageAdded = true;
          this.applyViewer(viewer);
        },
        error: (error: unknown) => this.alertService
          .open(getErrorMessage(error, `${this.languageName} could not be added. Please try again.`), {appearance: 'negative'})
          .subscribe(),
      });
  }

  createAccount(): void {
    this.returnPath.remember(this.router.url);
    void this.router.navigate(['/auth'], {fragment: 'sign-up'});
  }

  signIn(): void {
    this.returnPath.remember(this.router.url);
    void this.router.navigate(['/auth']);
  }

  scrollToWords(): void {
    this.wordRows?.first?.nativeElement.scrollIntoView({behavior: 'smooth', block: 'start'});
  }

  manageLink(): void {
    if (!this.shareSheet?.content) return;
    this.popupTemplateStateService.open(this.shareSheet.content, 'share-link');
  }

  onDeckChanged(deck: Deck): void {
    this.ownDeck = deck;
  }

  // --- the phone's pinned ask ----------------------------------------------------------------------

  private watchFirstRow(): void {
    this.rowObserver?.disconnect();
    this.rowObserver = null;
    this.showStickyAsk = false;
    const first = this.wordRows?.first?.nativeElement;
    if (!first || this.panel !== 'sign-up' || typeof IntersectionObserver === 'undefined') return;
    this.rowObserver = new IntersectionObserver(entries => {
      const entry = entries[0];
      this.showStickyAsk = this.narrow.matches && !entry.isIntersecting && entry.boundingClientRect.top < 0;
      this.cdr.detectChanges();
    });
    this.rowObserver.observe(first);
  }
}
