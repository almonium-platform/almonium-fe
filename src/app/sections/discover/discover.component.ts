import {Component, DestroyRef, ElementRef, HostListener, LOCALE_ID, OnInit, ViewChild, afterNextRender, inject} from '@angular/core';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {EmblemComponent} from '../../shared/emblem/emblem.component';
import {combineLatest, finalize} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {AppConstants} from '../../app.constants';
import {LanguageCode} from '../../models/language.enum';
import {TargetLanguageDropdownService} from '../../services/target-language-dropdown.service';
import {UserInfoService} from '../../services/user-info.service';
import {getErrorMessage} from '../../shared/http-error';
import {varietyRow} from '../../shared/language-varieties';
import {DiscoverLookup, DiscoverPronunciation, DiscoverSense, DiscoverService} from './discover.service';
import {BreakdownNoteKind, DiscoverBreakdown, DiscoverBreakdownService, PrivateText} from './discover-breakdown.service';
import {
  DiscoverTier, GUEST_CAP, GUEST_LANGUAGES, MEMBER_CAP, addRecent, forgetRecents, guessGuestLanguage, readRecents,
  rememberGuestLanguage, sizeOf, tierOf,
} from './discover-field';
import {SIGNATURE_LETTERS, ringFor} from './letter-ring';

/** The letter ring on offer: the position of the letter just typed, its ring, and which of it is in the text. */
interface LetterChip {
  position: number;
  ring: string[];
  index: number;
}

@Component({
  selector: 'app-discover',
  imports: [RouterLink, EmblemComponent],
  templateUrl: './discover.component.html',
  styleUrls: ['./discover.component.less'],
})
export class DiscoverComponent implements OnInit {
  private readonly discoverService = inject(DiscoverService);
  private readonly breakdownService = inject(DiscoverBreakdownService);
  private readonly languageService = inject(TargetLanguageDropdownService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly locale = inject(LOCALE_ID);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('field') private field?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('mark') private mark?: ElementRef<HTMLSpanElement>;
  @ViewChild('mirror') private mirror?: ElementRef<HTMLDivElement>;
  @ViewChild('recentRow') private recentRow?: ElementRef<HTMLElement>;

  protected searchText = '';
  /** The sentence a looked-up word came from; kept with the word when it is kept. */
  protected context = '';
  protected lookup: DiscoverLookup | null = null;
  protected selectedSenseIndex = 0;
  protected loading = false;
  protected errorMessage = '';
  protected audioError = '';
  private audio: HTMLAudioElement | null = null;
  protected currentLanguage = LanguageCode.EN;
  private preferredLanguage = LanguageCode.EN;
  private sourceLanguage: LanguageCode | null = null;
  protected guestLanguage = LanguageCode.EN;
  protected sourceBook = '';
  protected sourceBookTitle = '';
  /** The chapter sequence, when known: "Back to book" then returns to that chapter's page. */
  protected sourceChapter = '';
  protected sourceChapterTitle = '';

  protected focused = false;
  protected menuOpen = false;
  protected scrolled = false;
  protected chip: LetterChip | null = null;
  protected chipX = 0;
  protected chipY = 0;
  protected recents: string[] = [];
  protected breakdown: DiscoverBreakdown | null = null;
  /** True when the breakdown came from the stand-in service rather than the backend. */
  protected breakdownIsPreview = false;
  protected breakingDown = false;
  /** The language the field was set to before a breakdown found the text plainly in another. */
  protected correctedFrom: LanguageCode | null = null;
  protected privateText: PrivateText | null = null;
  protected savingText = false;
  private layoutFrame = 0;

  protected readonly guestLanguages = GUEST_LANGUAGES;
  protected readonly noteLabels: Record<BreakdownNoteKind, string> = {
    tense: $localize`Tense`,
    case: $localize`Case`,
    idiom: $localize`Idiom`,
    order: $localize`Word order`,
  };
  protected readonly wordFallback = $localize`word`;
  protected readonly unverifiedClipTitle = $localize`The machine check did not confirm that this clip says the word.`;
  protected readonly meaningFallback = $localize`Meaning not supplied`;

  protected get signedIn(): boolean {
    return this.userInfoService.currentUserInfo !== null;
  }

  /** Members listen in the navbar's language; guests in the one at the start of the line. */
  protected get fieldLanguage(): LanguageCode {
    return this.signedIn ? this.currentLanguage : this.guestLanguage;
  }

  protected get cap(): number {
    return this.signedIn ? MEMBER_CAP : GUEST_CAP;
  }

  protected get tier(): DiscoverTier {
    return tierOf(this.searchText, this.cap);
  }

  /** What ↵ will do, said before it is pressed. */
  protected get actionLabel(): string {
    switch (this.tier) {
      case 'word': return $localize`Look up`;
      case 'sentence':
      case 'passage': return $localize`Break down`;
      case 'over': return this.signedIn ? $localize`Open in the reader` : $localize`Sign in for longer text`;
      default: return '';
    }
  }

  protected get textSize(): string {
    return sizeOf(this.searchText);
  }

  protected get showCount(): boolean {
    return this.searchText.length >= this.cap * 0.8;
  }

  protected get count(): string {
    return `${this.searchText.length.toLocaleString(this.locale)} / ${this.cap.toLocaleString(this.locale)}`;
  }

  protected get showRecents(): boolean {
    return !this.searchText && this.recents.length > 0;
  }

  /** Nothing below the line yet: the line sits lower on the page, as the page's only object. */
  protected get atRest(): boolean {
    return !this.lookup && !this.breakdown && !this.privateText && !this.loading && !this.breakingDown && !this.errorMessage;
  }

  protected get selectedSense(): DiscoverSense | null {
    return this.lookup?.senses[this.selectedSenseIndex] ?? null;
  }

  /** The server's order, except that the variety this learner chose for the language comes first. */
  protected get pronunciations(): DiscoverPronunciation[] {
    const pronunciations = this.lookup?.pronunciations ?? [];
    const preferred = this.preferredVariety()?.toLowerCase();
    if (!preferred) return pronunciations;
    const isPreferred = (pronunciation: DiscoverPronunciation) => pronunciation.variety.toLowerCase() === preferred;
    return [...pronunciations].sort((a, b) => Number(isPreferred(b)) - Number(isPreferred(a)));
  }

  ngOnInit(): void {
    this.languageService.currentLanguage$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(language => {
      this.preferredLanguage = language || LanguageCode.EN;
      this.currentLanguage = this.sourceLanguage ?? this.preferredLanguage;
      this.recents = readRecents(this.fieldLanguage);
      this.chip = null;
    });
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(([path, params]) => {
      this.searchText = params.get('text') ?? '';
      this.context = params.get('context') ?? '';
      const language = (path.get('language') ?? params.get('language'))?.toUpperCase();
      this.sourceLanguage = Object.values(LanguageCode).includes(language as LanguageCode) ? language as LanguageCode : null;
      this.currentLanguage = this.sourceLanguage ?? this.preferredLanguage;
      this.guestLanguage = guessGuestLanguage(this.sourceLanguage, typeof navigator === 'undefined' ? [] : navigator.languages ?? []);
      this.recents = readRecents(this.fieldLanguage);
      const book = params.get('book') ?? '';
      this.sourceBook = /^[a-zA-Z0-9_-]{1,200}$/.test(book) ? book : '';
      this.sourceBookTitle = (params.get('bookTitle') ?? this.sourceBook).slice(0, 200);
      this.sourceChapterTitle = (params.get('chapterTitle') ?? params.get('chapter') ?? '').slice(0, 200);
      this.sourceChapter = /^\d{1,4}$/.test(params.get('chapter') ?? '') ? params.get('chapter')! : '';
      if (this.context) {
        this.breakdown = {language: this.fieldLanguage, sentences: [{text: this.context, translation: null, notes: []}]};
        this.breakdownIsPreview = false;
      }
      if (this.searchText) this.submitSearch();
      this.scheduleLayout();
    });
  }

  constructor() {
    // The line is focused on arrival, once it is on the page.
    afterNextRender(() => {
      this.focusField();
      this.scheduleLayout();
    });
  }

  /** "/" or ⌘K brings the line back from anywhere on the page. */
  @HostListener('window:keydown', ['$event'])
  protected focusShortcut(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const editable = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !editable;
    const commandK = (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k';
    if (!slash && !commandK) return;
    event.preventDefault();
    this.focusField();
  }

  protected onInput(event: Event): void {
    const field = event.target as HTMLTextAreaElement;
    const value = field.value;
    const caret = field.selectionStart;
    const previous = this.searchText;
    this.chip = null;
    // Offer the ring only for a single letter just typed at the caret, not for pastes or deletions.
    if (value.length === previous.length + 1 && caret > 0 && field.selectionEnd === caret
      && value.slice(0, caret - 1) + value.slice(caret) === previous) {
      const ring = ringFor(this.fieldLanguage, value[caret - 1]);
      if (ring) this.chip = {position: caret - 1, ring, index: 0};
    }
    this.searchText = value;
    this.context = '';
    this.scheduleLayout();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const field = event.target as HTMLTextAreaElement;
    const chip = this.chip;
    const caretAfterChip = !!chip && field.selectionStart === chip.position + 1 && field.selectionEnd === field.selectionStart;
    if (event.key === 'ArrowUp' && chip && caretAfterChip) {
      event.preventDefault();
      this.applyChip((chip.index + 1) % chip.ring.length);
      return;
    }
    // Any other key keeps what is there; a typed letter offers its own ring from the input that follows.
    if (!['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)) this.chip = null;
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submitSearch();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (this.menuOpen) this.menuOpen = false;
      else if (this.searchText) this.clearField();
      else field.blur();
    } else if (event.key === 'ArrowDown' && !this.searchText && this.showRecents) {
      event.preventDefault();
      this.recentButtons()[0]?.focus();
    }
  }

  protected onRecentKeydown(event: KeyboardEvent): void {
    const buttons = this.recentButtons();
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    } else if (event.key === 'ArrowUp' || event.key === 'Escape') {
      event.preventDefault();
      this.focusField();
    }
  }

  /** Clicking or tapping a variant applies it, as ↑ would. */
  protected pickVariant(event: MouseEvent, index: number): void {
    event.preventDefault();
    this.applyChip(index);
  }

  protected onFieldScroll(field: HTMLTextAreaElement): void {
    this.scrolled = field.scrollTop > 0;
    if (this.chip) this.scheduleLayout();
  }

  protected toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  protected pickGuestLanguage(language: LanguageCode): void {
    this.setGuestLanguage(language);
    this.menuOpen = false;
    this.focusField();
  }

  protected languageName(language: LanguageCode): string {
    return displayName(language, this.locale);
  }

  protected nativeName(language: LanguageCode): string {
    return displayName(language, language.toLowerCase());
  }

  protected letters(language: LanguageCode): string {
    return SIGNATURE_LETTERS[language] ?? '';
  }

  /** Forgets this language's recent lookups on this device, and hands the line back. */
  protected clearRecents(): void {
    this.recents = forgetRecents(this.fieldLanguage);
    this.focusField();
  }

  protected openRecent(entry: string): void {
    this.searchText = entry;
    this.context = '';
    this.chip = null;
    this.submitSearch();
    this.focusField();
  }

  protected submitSearch(): void {
    const input = this.searchText.trim();
    if (!input) return;
    this.chip = null;
    this.menuOpen = false;
    switch (tierOf(input, this.cap)) {
      case 'word':
        if (!this.context) this.breakdown = null;
        this.privateText = null;
        this.lookupWord(input.replace(/\s+/g, ' '), this.context, this.fieldLanguage);
        return;
      case 'sentence':
      case 'passage':
        this.breakDown(input);
        return;
      case 'over':
        if (this.signedIn) this.saveToReader(input);
        else void this.router.navigate(['/auth']);
        return;
    }
  }

  /** Opens a word of the breakdown, with its sentence attached as context. */
  protected openToken(token: string, sentence: string): void {
    this.lookupWord(token, sentence, this.breakdown?.language ?? this.fieldLanguage);
  }

  protected tokens(sentence: string): string[] {
    return sentence.match(/[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu) ?? [];
  }

  protected lookupWord(word: string, context = '', language = this.fieldLanguage): void {
    const entry = word.replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}'’-]+$/gu, '');
    if (!entry) return;
    this.context = context;
    this.loading = true;
    this.errorMessage = '';
    this.discoverService.lookup(entry, language, this.translationLanguage(language), context || undefined)
      .pipe(finalize(() => this.loading = false), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: lookup => {
          this.lookup = lookup;
          this.selectedSenseIndex = 0;
          this.recents = addRecent(lookup.language, lookup.entry);
        },
        error: error => this.errorMessage = getErrorMessage(error, $localize`This word sheet could not be loaded. Please try again.`),
      });
  }

  protected selectSense(index: number): void {
    this.selectedSenseIndex = index;
  }

  /** "British" for en-GB; the bare tag when this build does not know the variety. */
  protected varietyLabel(tag: string): string {
    const language = this.lookup?.language ?? this.fieldLanguage;
    return varietyRow(language)?.varieties.find(variety => variety.tag.toLowerCase() === tag.toLowerCase())?.label ?? tag;
  }

  protected listen(pronunciation: DiscoverPronunciation): void {
    if (!pronunciation.clipUrl) return;
    this.audio?.pause();
    this.audioError = '';
    this.audio = new Audio(`${AppConstants.API_URL}${pronunciation.clipUrl}`);
    this.audio.play().catch(() => this.audioError = $localize`The clip could not be played. Please try again.`);
  }

  private breakDown(text: string): void {
    const asked = this.fieldLanguage;
    this.lookup = null;
    this.privateText = null;
    this.errorMessage = '';
    this.correctedFrom = null;
    this.breakingDown = true;
    this.breakdownService.breakdown(text, asked)
      .pipe(finalize(() => this.breakingDown = false), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: breakdown => {
          this.breakdown = breakdown;
          this.breakdownIsPreview = true;
          if (breakdown.language !== asked) {
            this.correctedFrom = asked;
            this.followLanguage(breakdown.language);
          }
        },
        error: error => this.errorMessage = getErrorMessage(error, $localize`This text could not be broken down. Please try again.`),
      });
  }

  private saveToReader(text: string): void {
    this.lookup = null;
    this.breakdown = null;
    this.errorMessage = '';
    this.savingText = true;
    this.breakdownService.saveToReader(text)
      .pipe(finalize(() => this.savingText = false), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: saved => this.privateText = saved,
        error: error => this.errorMessage = getErrorMessage(error, $localize`The text could not be saved to the reader. Please try again.`),
      });
  }

  /** A wrong guess is corrected after ↵: the field's language follows the text it was given. */
  private followLanguage(language: LanguageCode): void {
    if (!this.signedIn) {
      this.setGuestLanguage(language);
    } else if (this.userInfoService.currentUserInfo?.activeTargetLangs.includes(language)) {
      this.languageService.setCurrentLanguage(language);
    }
  }

  private setGuestLanguage(language: LanguageCode): void {
    this.guestLanguage = language;
    this.chip = null;
    this.recents = readRecents(language);
    rememberGuestLanguage(language);
  }

  private applyChip(index: number): void {
    const chip = this.chip;
    const field = this.field?.nativeElement;
    if (!chip || !field) return;
    const text = this.searchText.slice(0, chip.position) + chip.ring[index] + this.searchText.slice(chip.position + 1);
    this.searchText = text;
    this.chip = {...chip, index};
    field.value = text;
    field.focus({preventScroll: true});
    field.setSelectionRange(chip.position + 1, chip.position + 1);
    this.scheduleLayout();
  }

  private clearField(): void {
    if (this.field) this.field.nativeElement.value = '';
    this.searchText = '';
    this.context = '';
    this.chip = null;
    this.scheduleLayout();
  }

  private focusField(): void {
    this.field?.nativeElement.focus({preventScroll: true});
  }

  private recentButtons(): HTMLButtonElement[] {
    return Array.from(this.recentRow?.nativeElement.querySelectorAll('button') ?? []);
  }

  /** Grows the line with its text, and floats the chip above the letter it offers variants for. */
  private scheduleLayout(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    cancelAnimationFrame(this.layoutFrame);
    this.layoutFrame = requestAnimationFrame(() => {
      const field = this.field?.nativeElement;
      if (!field) return;
      const scrollTop = field.scrollTop;
      field.style.height = 'auto';
      field.style.height = `${field.scrollHeight}px`;
      field.scrollTop = scrollTop;
      if (this.mirror) this.mirror.nativeElement.style.width = `${field.clientWidth}px`;
      const mark = this.mark?.nativeElement;
      if (this.chip && mark) {
        this.chipX = mark.offsetLeft + mark.offsetWidth / 2;
        this.chipY = mark.offsetTop - field.scrollTop;
      }
    });
  }

  private preferredVariety(): string | null {
    const language = this.lookup?.language;
    return this.userInfoService.currentUserInfo?.learners.find(learner => learner.language === language)?.variety ?? null;
  }

  private translationLanguage(language: LanguageCode): LanguageCode {
    const fluent = this.userInfoService.currentUserInfo?.fluentLangs.find(fluentLanguage => fluentLanguage !== language);
    if (fluent) return fluent;
    return language === LanguageCode.EN ? LanguageCode.UK : LanguageCode.EN;
  }
}

/** A language's name in the given locale, capitalised as a menu label; the code only if the browser has no name for it. */
function displayName(language: LanguageCode, locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale, 'en'], {type: 'language'}).of(language.toLowerCase()) ?? language;
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch {
    return language;
  }
}
