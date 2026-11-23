import {Component, DestroyRef, ElementRef, HostListener, LOCALE_ID, OnInit, ViewChild, afterNextRender, inject, ChangeDetectionStrategy} from '@angular/core';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {EmblemComponent} from '../../shared/emblem/emblem.component';
import {Subject, catchError, combineLatest, debounceTime, distinctUntilChanged, finalize, of, switchMap} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {AppConstants} from '../../app.constants';
import {LanguageCode} from '../../models/language.enum';
import {CEFRLevel, SenseLead} from '../../models/userinfo.model';
import {CardDto} from '../../models/card.model';
import {CardService} from '../../services/card.service';
import {TargetLanguageDropdownService} from '../../services/target-language-dropdown.service';
import {UserInfoService} from '../../services/user-info.service';
import {getErrorMessage} from '../../shared/http-error';
import {varietyRow} from '../../shared/language-varieties';
import {DiscoverHomophone, DiscoverLookup, DiscoverPronunciation, DiscoverSense, DiscoverService, DiscoverSuggestion} from './discover.service';
import {BreakdownNoteKind, DiscoverBreakdown, DiscoverBreakdownService, PrivateText} from './discover-breakdown.service';
import {
  DiscoverTier, GUEST_CAP, GUEST_LANGUAGES, MEMBER_CAP, addRecent, forgetRecents, guessGuestLanguage, readRecents,
  rememberGuestLanguage, removeRecent, sizeOf, tierOf,
} from './discover-field';
import {LexemeFacts, SenseFacts, lexemeFacts, senseFacts} from './entry-shape';
import {SIGNATURE_LETTERS, ringFor} from './letter-ring';
import {PronunciationCell, PronunciationTable, numberRanges, pronunciationTable, speakerKey} from './pronunciation-table';
import {EntryReportComponent} from './report/entry-report.component';
import {EntryReport} from './report/entry-report.service';
import {SENSES_SHOWN, SenseGroup, SenseRow, frequencyBars, groupSenses, hiddenCounts, leadsWithDefinition, toGroups} from './word-sheet';

/** The letter ring on offer: the position of the letter just typed, its ring, and which of it is in the text. */
interface LetterChip {
  position: number;
  ring: string[];
  index: number;
}

/** What to ask the lexicon for: a prefix in a language, glossed in another. Null asks for nothing. */
type SuggestionQuery = {prefix: string; language: LanguageCode; glossLanguage: LanguageCode} | null;

/** The article a German noun is shown with in the suggestion rows. */
const GERMAN_ARTICLES: Record<string, string> = {Masc: 'der', Fem: 'die', Neut: 'das'};

/** A second click on a speaker while it plays replays at this rate (design 5a). */
const SLOW_RATE = 0.6;

/** Universal part-of-speech tags as the sheet heads its groups. */
const PARTS_OF_SPEECH: Record<string, string> = {
  ADJ: $localize`adjective`,
  ADP: $localize`preposition`,
  ADV: $localize`adverb`,
  AUX: $localize`auxiliary verb`,
  CCONJ: $localize`conjunction`,
  DET: $localize`determiner`,
  INTJ: $localize`interjection`,
  NOUN: $localize`noun`,
  NUM: $localize`numeral`,
  PART: $localize`particle`,
  PRON: $localize`pronoun`,
  PROPN: $localize`proper noun`,
  SCONJ: $localize`conjunction`,
  VERB: $localize`verb`,
};

@Component({
  selector: 'app-discover',
  imports: [RouterLink, EmblemComponent, EntryReportComponent],
  templateUrl: './discover.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./discover.component.less'],
})
export class DiscoverComponent implements OnInit {
  private readonly discoverService = inject(DiscoverService);
  private readonly breakdownService = inject(DiscoverBreakdownService);
  private readonly cardService = inject(CardService);
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
  /** The sheet's senses in display order; `selectedRow` indexes it. */
  protected senseRows: SenseRow[] = [];
  protected pronunciationTable: PronunciationTable = {columns: [], rows: [], pending: 0};
  /** The sense under the pointer, which lights its column as selecting it does (design 7a). */
  protected hoveredSense: number | null = null;
  /** The reading under the pointer or focus, which lights the senses that take it (design 7b). */
  protected hoveredReading: DiscoverPronunciation | null = null;
  /** On a phone only the learner's accent is open; the others fold into one line until it is tapped (design 7c). */
  protected otherAccentsOpen = false;
  protected senseGroups: SenseGroup[] = [];
  /** What each sense says besides its meaning, by `DiscoverSense.index`, and each word, by `DiscoverLexeme.index`. */
  protected senseFacts = new Map<number, SenseFacts>();
  protected lexemeFacts = new Map<number, LexemeFacts>();
  /** A sense's collocations are cut to this many until it is the selected one. */
  protected readonly collocationsShown = 3;
  protected selectedRow = 0;
  protected expanded = false;
  /** The card each kept sense became, by sense index, so that Kept can take it back. */
  protected keptCards = new Map<number, string>();
  protected keeping = new Set<number>();
  protected keepError = '';
  /** The report panel that is open: under the word (`word`) or under the sense with this index. */
  protected reporting: 'word' | number | null = null;
  /** The panel's target, made once when it opens so the panel keeps one object. */
  protected reportTarget: Omit<EntryReport, 'reason' | 'comment'> | null = null;
  protected reportSubject = '';
  protected readonly reportLabel = $localize`Report a problem`;
  /** The speaker playing, and whether it is the slow replay. */
  protected playing: string | null = null;
  protected slow = false;
  private playToken = 0;
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
  protected suggestions: DiscoverSuggestion[] = [];
  /** The row ↑↓ is on; -1 while the text as typed is what ↵ will look up. */
  protected activeSuggestion = -1;
  private readonly suggestionQueries = new Subject<SuggestionQuery>();

  protected readonly guestLanguages = GUEST_LANGUAGES;
  protected readonly noteLabels: Record<BreakdownNoteKind, string> = {
    tense: $localize`Tense`,
    case: $localize`Case`,
    idiom: $localize`Idiom`,
    order: $localize`Word order`,
  };
  protected readonly noRecordingTitle = $localize`No recording yet`;
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

  protected get showSuggestions(): boolean {
    return this.suggestions.length > 0 && this.tier === 'word';
  }

  /** Nothing below the line yet: the line sits lower on the page, as the page's only object. */
  protected get atRest(): boolean {
    return !this.lookup && !this.breakdown && !this.privateText && !this.loading && !this.breakingDown && !this.errorMessage;
  }

  protected get selectedSense(): DiscoverSense | null {
    return this.senseRows[this.selectedRow]?.sense ?? null;
  }

  /** Settings → Learning, applied with the learner's level in the language looked up. */
  protected get definitionLeads(): boolean {
    const user = this.userInfoService.currentUserInfo;
    const lead: SenseLead = user?.uiPreferences?.learning?.senseLead ?? 'level';
    const level: CEFRLevel | null = user?.learners.find(learner => learner.language === this.lookup?.language)?.selfReportedLevel ?? null;
    return leadsWithDefinition(lead, level);
  }

  protected get hiddenRows(): SenseRow[] {
    return this.senseRows.slice(SENSES_SHOWN);
  }

  protected get moreLabel(): string {
    return this.expanded ? $localize`Fewer senses` : $localize`Show ${this.hiddenRows.length}:count: more`;
  }

  /** "4 adjective · 1 adverb": what the hidden rows hold, beside "Show N more". */
  protected get moreHint(): string {
    if (this.expanded) return '';
    return hiddenCounts(this.hiddenRows).map(({partOfSpeech, count}) => `${count} ${this.partOfSpeechLabel(partOfSpeech)}`).join(' · ');
  }

  protected get frequencyBarCount(): number {
    return this.lookup?.frequency ? frequencyBars(this.lookup.frequency.score) : 0;
  }

  /** The band in a word, from the same thresholds the server names its bands by. */
  protected get frequencyBand(): string {
    const score = this.lookup?.frequency?.score ?? 0;
    if (score >= 75) return $localize`very common`;
    if (score >= 50) return $localize`common`;
    if (score >= 25) return $localize`less common`;
    return $localize`rare`;
  }

  /** The score, the corpus and the dictionary behind the sheet, which the mark keeps out of sight. */
  protected get frequencyTitle(): string {
    const frequency = this.lookup?.frequency;
    const parts = frequency ? [$localize`Relative corpus score ${frequency.score}:score:`, frequency.provenance] : [];
    if (this.lookup?.provider) parts.push($localize`Dictionary: ${this.lookup.provider}:provider:`);
    return parts.join(' · ');
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
    this.suggestionQueries.pipe(
      debounceTime(120),
      distinctUntilChanged((a, b) => a?.prefix === b?.prefix && a?.language === b?.language && a?.glossLanguage === b?.glossLanguage),
      switchMap(query => query
        ? this.discoverService.suggest(query.prefix, query.language, query.glossLanguage).pipe(catchError(() => of([])))
        : of([])),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(suggestions => {
      this.suggestions = suggestions;
      this.activeSuggestion = -1;
    });
    this.languageService.currentLanguage$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(language => {
      this.preferredLanguage = language || LanguageCode.EN;
      this.currentLanguage = this.sourceLanguage ?? this.preferredLanguage;
      this.recents = readRecents(this.fieldLanguage);
      this.chip = null;
      this.requestSuggestions();
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

  /** "/" or ⌘K brings the line back from anywhere on the page; off the line, ↑↓, K and P work the sheet. */
  @HostListener('window:keydown', ['$event'])
  protected focusShortcut(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const editable = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    if (!editable && this.sheetShortcut(event)) return;
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
    this.requestSuggestions();
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
    if (this.showSuggestions && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      // ↓ walks down the rows; ↑ walks back up and, past the first, returns to the text as typed.
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.activeSuggestion = Math.min(Math.max(this.activeSuggestion + step, -1), this.suggestions.length - 1);
    } else if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      const active = this.showSuggestions ? this.suggestions[this.activeSuggestion] : undefined;
      if (active) this.openSuggestion(active);
      else this.submitSearch();
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

  /** "die Ausgabe" for a German noun; the bare headword everywhere else. */
  protected suggestionLabel(suggestion: DiscoverSuggestion): string {
    const article = this.fieldLanguage === LanguageCode.DE && suggestion.partOfSpeech === 'NOUN'
      ? GERMAN_ARTICLES[suggestion.gender ?? ''] : undefined;
    return article ? `${article} ${suggestion.headword}` : suggestion.headword;
  }

  /** Puts the headword in the line and looks it up, as ↵ on its row does. */
  protected openSuggestion(suggestion: DiscoverSuggestion): void {
    if (this.field) this.field.nativeElement.value = suggestion.headword;
    this.searchText = suggestion.headword;
    this.context = '';
    this.chip = null;
    this.submitSearch();
    this.focusField();
    this.scheduleLayout();
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
    this.closeSuggestions();
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
          this.showLookup(lookup);
          addRecent(lookup.language, lookup.entry);
          this.recents = readRecents(this.fieldLanguage);
        },
        error: error => this.errorMessage = getErrorMessage(error, $localize`This word sheet could not be loaded. Please try again.`),
      });
  }

  /** Whether the reader can switch the field's active language to `language` with one click. */
  protected canSwitchFieldTo(language: LanguageCode): boolean {
    if (this.fieldLanguage === language) return false;
    if (!this.signedIn) return GUEST_LANGUAGES.includes(language);
    return this.userInfoService.currentUserInfo?.activeTargetLangs.includes(language) ?? false;
  }

  protected switchFieldLanguage(language: LanguageCode): void {
    this.sourceLanguage = null;
    this.followLanguage(language);
    this.recents = readRecents(this.fieldLanguage);
    this.closeSuggestions();
  }

  protected lookupInLanguage(language: LanguageCode): void {
    if (!this.lookup) return;
    this.lookupWord(this.lookup.entry, '', language);
  }

  protected isFluentLanguage(language: LanguageCode): boolean {
    return this.userInfoService.currentUserInfo?.fluentLangs.includes(language) ?? false;
  }

  /** Only a member can flag, and only a lexicon entry: the old providers' senses have nowhere to be fixed. */
  protected get canReport(): boolean {
    return this.signedIn && this.lookup?.provider === 'lexicon';
  }

  /** Opens the report panel for the word, or for one sense; a second tap on the same flag closes it. */
  protected openReport(row: SenseRow | null, event?: Event): void {
    event?.stopPropagation();
    const lookup = this.lookup;
    const at = row?.sense.key ? row.sense.index : 'word';
    if (!lookup || this.reporting === at) {
      this.closeReport();
      return;
    }
    const sense = at === 'word' ? null : row!.sense;
    const headword = sense?.headword ?? lookup.senses[0]?.headword ?? lookup.entry;
    this.reporting = at;
    this.reportSubject = sense ? $localize`sense ${row!.number}:number: of “${headword}:headword:”` : `“${headword}”`;
    const context = [lookup.sourceContext, this.context].find(value => value?.trim());
    this.reportTarget = {
      language: lookup.language,
      headword,
      senseKey: sense?.key ?? null,
      context: context ? context.slice(0, 1000) : null,
      book: this.sourceBook || null,
    };
  }

  protected closeReport(): void {
    this.reporting = null;
    this.reportTarget = null;
  }

  protected selectRow(index: number): void {
    this.selectedRow = index;
  }

  protected toggleMore(): void {
    this.expanded = !this.expanded;
    if (!this.expanded && this.selectedRow >= SENSES_SHOWN) this.selectedRow = 0;
    this.senseGroups = this.visibleGroups();
  }

  /** The sense line the reader's setting puts first; the other one, when there is one, goes under it. */
  protected senseLead(sense: DiscoverSense): string {
    const translation = sense.translations.join(', ');
    const definition = sense.definition ?? '';
    return (this.definitionLeads ? definition || translation : translation || definition) || this.meaningFallback;
  }

  protected senseSub(sense: DiscoverSense): string {
    const translation = sense.translations.join(', ');
    const definition = sense.definition ?? '';
    if (!translation || !definition) return '';
    return this.definitionLeads ? translation : definition;
  }

  /** The sheet number of a sense by its index: a form or a relation that belongs to some senses names them by it. */
  protected senseNumbers(indexes: number[]): string {
    const numbers = this.senseRows.filter(row => indexes.includes(row.sense.index)).map(row => row.number).sort((a, b) => a - b);
    if (!numbers.length) return '';
    return numbers.length === 1 ? $localize`meaning ${numbers[0]}:number:` : $localize`meanings ${numberRanges(numbers)}:numbers:`;
  }

  /** The lemma over a group when it is not the sheet's own headline: "kraft" under Kraft. */
  protected groupLemma(group: SenseGroup): string {
    const lemma = this.lookup?.lexemes.find(lexeme => lexeme.index === group.lexeme)?.lemma ?? '';
    return lemma && lemma !== (this.selectedSense?.headword ?? this.lookup?.entry) ? lemma : '';
  }

  protected partOfSpeechLabel(partOfSpeech: string | null): string {
    if (!partOfSpeech) return '';
    return PARTS_OF_SPEECH[partOfSpeech.toUpperCase()] ?? partOfSpeech.toLowerCase();
  }

  /** Keep on the selected row, Kept to take it back; a guest is sent to sign in. */
  protected toggleKeep(row: SenseRow, event?: Event): void {
    event?.stopPropagation();
    const lookup = this.lookup;
    if (!lookup) return;
    if (!this.signedIn) {
      void this.router.navigate(['/auth']);
      return;
    }
    const sense = row.sense;
    if (this.keeping.has(sense.index)) return;
    this.keeping.add(sense.index);
    this.keepError = '';
    const release = () => this.keeping.delete(sense.index);
    const cardId = this.keptCards.get(sense.index);
    if (cardId) {
      this.cardService.deleteCard(cardId).pipe(finalize(release), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => this.keptCards.delete(sense.index),
        error: error => this.keepError = getErrorMessage(error, $localize`The sense could not be taken back. Please try again.`),
      });
      return;
    }
    const meaning = sense.translations.length ? sense.translations : [sense.definition ?? lookup.entry];
    const example = lookup.sourceContext ?? sense.examples[0]?.text;
    this.cardService.createCard({
      entry: lookup.entry,
      language: lookup.language,
      translations: meaning.map(translation => ({translation})),
      partOfSpeech: sense.partOfSpeech ?? undefined,
      selectedSense: senseKey(sense),
      senseKey: sense.key ?? undefined,
      sourceContext: lookup.sourceContext ?? undefined,
      learningIntents: ['UNDERSTAND'],
      itemType: lookup.entry.includes(' ') ? 'PHRASE' : 'WORD',
      examples: example ? [{example, translation: ''}] : [],
      activeLearning: true,
      learnt: false,
      priority: 0,
    }).pipe(finalize(release), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: card => {
        if (card.id) this.keptCards.set(sense.index, card.id);
        this.recents = removeRecent(lookup.language, lookup.entry);
      },
      error: error => this.keepError = getErrorMessage(error, $localize`The sense could not be kept. Please try again.`),
    });
  }

  /** The column a sense's readings stand in, which lights from header to last row; -1 for a one-column word. */
  protected get litColumn(): number {
    return this.litColumnOf(this.hoveredSense ?? this.selectedSense?.index);
  }

  /** The senses taking the reading under the pointer, or the one playing (touch has no hover), lit in the list. */
  protected get litSenses(): number[] {
    if (!this.pronunciationTable.columns.length) return [];
    const playing = this.pronunciations.find(pronunciation => speakerKey(pronunciation) === this.playing);
    return (this.hoveredReading ?? playing)?.senses ?? [];
  }

  protected cellLit(cell: PronunciationCell): boolean {
    return this.litColumn >= cell.column && this.litColumn < cell.column + cell.span;
  }

  /**
   * Where a word said like this one is said alike, when not everywhere and for every meaning: "American",
   * "meanings 1–2", "British, meaning 3"; empty when it holds for all the sheet shows.
   */
  protected homophoneNote(homophone: DiscoverHomophone): string {
    const parts: string[] = [];
    const varieties = [...new Set(this.pronunciations.map(pronunciation => pronunciation.variety))];
    if (varieties.some(variety => !homophone.varieties.includes(variety))) {
      parts.push(homophone.varieties.filter(variety => varieties.includes(variety)).map(variety => this.varietyLabel(variety)).join(', '));
    }
    if (this.senseRows.some(row => !homophone.senses.includes(row.sense.index))) {
      const numbers = this.senseRows.filter(row => homophone.senses.includes(row.sense.index)).map(row => row.number).sort((a, b) => a - b);
      parts.push(numbers.length === 1
        ? $localize`meaning ${numbers[0]}:number:`
        : $localize`meanings ${numberRanges(numbers)}:numbers:`);
    }
    return parts.filter(Boolean).join(', ');
  }

  /** "American, Australian": the accents folded under the learner's on a phone. */
  protected get otherAccents(): string {
    return this.pronunciationTable.rows.slice(1).map(row => this.varietyLabel(row.variety)).join(', ');
  }

  /** What P plays: the selected sense's column in the learner's accent, its first reading. */
  private get selectedReading(): DiscoverPronunciation | null {
    const learner = this.pronunciationTable.rows[0];
    const column = Math.max(this.litColumnOf(this.selectedSense?.index), 0);
    const cell = learner?.cells.find(each => column >= each.column && column < each.column + each.span);
    return cell?.lines[0]?.[0]?.pronunciation ?? null;
  }

  private litColumnOf(sense: number | undefined): number {
    return this.pronunciationTable.columns.findIndex(column => sense !== undefined && column.senses.includes(sense));
  }

  /** The headword in a pronunciation's variety: its recording first, synthesis without one. */
  protected listen(pronunciation: DiscoverPronunciation, slow = false): void {
    const word = this.selectedSense?.headword ?? this.lookup?.entry ?? '';
    this.play(speakerKey(pronunciation), word, pronunciation.variety, pronunciation.clipUrl, slow);
  }

  protected listenLabel(pronunciation: DiscoverPronunciation): string {
    return $localize`Play the ${this.varietyLabel(pronunciation.variety)}:variety: pronunciation`;
  }

  protected listenExample(row: SenseRow, event: Event): void {
    event.stopPropagation();
    if (!row.example) return;
    const variety = this.pronunciations[0]?.variety ?? this.lookup?.language.toLowerCase() ?? '';
    this.play(`example:${row.sense.index}`, row.example.text, variety, null);
  }

  /** "British" for en-GB; the bare tag when this build does not know the variety. */
  protected varietyLabel(tag: string): string {
    const language = this.lookup?.language ?? this.fieldLanguage;
    return varietyRow(language)?.varieties.find(variety => variety.tag.toLowerCase() === tag.toLowerCase())?.label ?? tag;
  }

  /**
   * Plays one speaker. A second click while it plays replays it at 0.6×; the clip is tried first and synthesis in
   * the variety's voice takes over when there is no clip or it will not play.
   */
  private play(key: string, text: string, variety: string, clipUrl: string | null, forceSlow = false): void {
    const slow = forceSlow || (this.playing === key && !this.slow);
    this.stopPlaying();
    const token = ++this.playToken;
    this.playing = key;
    this.slow = slow;
    this.audioError = '';
    const done = () => {
      if (this.playToken !== token) return;
      this.playing = null;
      this.slow = false;
    };
    const synthesise = () => {
      const synthesis = typeof window === 'undefined' ? undefined : window.speechSynthesis;
      if (!synthesis || typeof SpeechSynthesisUtterance === 'undefined' || !text) {
        this.audioError = $localize`The clip could not be played. Please try again.`;
        done();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = variety;
      utterance.rate = slow ? SLOW_RATE : 1;
      utterance.onend = done;
      utterance.onerror = done;
      synthesis.speak(utterance);
    };
    if (!clipUrl) {
      synthesise();
      return;
    }
    const audio = this.audio = new Audio(`${AppConstants.API_URL}${clipUrl}`);
    audio.playbackRate = slow ? SLOW_RATE : 1;
    audio.onended = done;
    audio.play().catch(() => {
      if (this.playToken === token) synthesise();
    });
  }

  private stopPlaying(): void {
    this.audio?.pause();
    this.audio = null;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // No synthesis in this browser: nothing is speaking.
    }
  }

  private showLookup(lookup: DiscoverLookup): void {
    this.stopPlaying();
    this.playing = null;
    this.lookup = lookup;
    this.senseRows = groupSenses(lookup.senses);
    const varietyName = (tag: string) => this.varietyLabel(tag);
    this.senseFacts = new Map(lookup.senses.map(sense => [sense.index, senseFacts(sense, lookup.language, varietyName, this.locale)]));
    this.lexemeFacts = new Map(lookup.lexemes.map(lexeme => [lexeme.index, lexemeFacts(lexeme, lookup.language, varietyName)]));
    this.setPronunciationRows();
    this.selectedRow = 0;
    this.expanded = false;
    this.senseGroups = this.visibleGroups();
    this.keptCards = new Map();
    this.keepError = '';
    this.closeReport();
    if (this.signedIn) this.loadKept(lookup);
  }

  /** Marks the senses of this entry already kept, so Keep does not make a second card of one. */
  private loadKept(lookup: DiscoverLookup): void {
    this.cardService.getCardsInLanguage(lookup.language).pipe(catchError(() => of<CardDto[]>([])), takeUntilDestroyed(this.destroyRef))
      .subscribe(cards => {
        if (this.lookup !== lookup) return;
        const entry = lookup.entry.toLocaleLowerCase();
        for (const sense of lookup.senses) {
          const card = cards.find(card => sense.key
            ? card.senseKey === sense.key
            : card.entry.toLocaleLowerCase() === entry && card.selectedSense === senseKey(sense));
          if (card?.id) this.keptCards.set(sense.index, card.id);
        }
      });
  }

  /** Every variety keeps its row even when it transcribes the word like another: the recordings still differ. */
  private setPronunciationRows(): void {
    this.pronunciationTable = pronunciationTable(this.pronunciations, this.senseRows, partOfSpeech => this.partOfSpeechLabel(partOfSpeech));
    this.hoveredSense = null;
    this.hoveredReading = null;
    this.otherAccentsOpen = false;
  }

  private visibleGroups(): SenseGroup[] {
    return toGroups(this.expanded ? this.senseRows : this.senseRows.slice(0, SENSES_SHOWN));
  }

  /** ↑↓ move the selection over the rows shown, K keeps the selected one, P plays the headword (⇧P slow). */
  private sheetShortcut(event: KeyboardEvent): boolean {
    if (!this.lookup || this.loading || event.ctrlKey || event.metaKey || event.altKey) return false;
    const shown = this.expanded ? this.senseRows.length : Math.min(SENSES_SHOWN, this.senseRows.length);
    const key = event.key.toLowerCase();
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && shown && !event.shiftKey) {
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.selectedRow = Math.min(Math.max(this.selectedRow + step, 0), shown - 1);
    } else if (key === 'k' && !event.shiftKey && this.senseRows[this.selectedRow]) {
      this.toggleKeep(this.senseRows[this.selectedRow]);
    } else if (key === 'p' && this.selectedReading) {
      this.listen(this.selectedReading, event.shiftKey);
    } else {
      return false;
    }
    event.preventDefault();
    return true;
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
      this.preferredLanguage = language;
      this.currentLanguage = this.sourceLanguage ?? language;
      this.languageService.setCurrentLanguage(language);
    }
  }

  private setGuestLanguage(language: LanguageCode): void {
    this.guestLanguage = language;
    this.chip = null;
    this.recents = readRecents(language);
    rememberGuestLanguage(language);
    this.requestSuggestions();
  }

  /** Asks for rows while the line holds a word or short expression; anything longer asks for none. */
  private requestSuggestions(): void {
    const prefix = this.searchText.trim().replace(/\s+/g, ' ');
    const wanted = prefix.length >= 2 && prefix.length <= 64 && !this.searchText.includes('\n') && this.tier === 'word';
    if (!wanted) this.suggestions = [];
    this.suggestionQueries.next(wanted
      ? {prefix, language: this.fieldLanguage, glossLanguage: this.translationLanguage(this.fieldLanguage)}
      : null);
  }

  private closeSuggestions(): void {
    this.suggestions = [];
    this.activeSuggestion = -1;
    this.suggestionQueries.next(null);
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
    this.requestSuggestions();
    this.scheduleLayout();
  }

  private clearField(): void {
    if (this.field) this.field.nativeElement.value = '';
    this.searchText = '';
    this.context = '';
    this.chip = null;
    this.closeSuggestions();
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

/** How a kept card names the sense it was kept for, and how the sheet finds it again. */
function senseKey(sense: DiscoverSense): string {
  return `${sense.index}: ${sense.translations.join(', ') || (sense.definition ?? sense.headword)}`;
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
