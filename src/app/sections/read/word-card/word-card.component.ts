import {ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject} from '@angular/core';
import {Router} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {finalize} from 'rxjs';
import {LanguageCode} from '../../../models/language.enum';
import {CardService} from '../../../services/card.service';
import {LanguageNameService} from '../../../services/language-name.service';
import {UserInfoService} from '../../../services/user-info.service';
import {ReturnPathService} from '../../../services/return-path.service';
import {getErrorMessage} from '../../../shared/http-error';
import {EmblemComponent} from '../../../shared/emblem/emblem.component';
import {DiscoverLookup, DiscoverSense, DiscoverService} from '../../discover/discover.service';

/** The articles that carry gender in the languages the dictionary returns them for. */
const ARTICLE_GENDERS: Record<string, string> = {
  der: 'masc.', die: 'fem.', das: 'neut.',
  le: 'masc.', la: 'fem.',
  el: 'masc.',
  il: 'masc.', lo: 'masc.',
  o: 'masc.', a: 'fem.',
};

export interface WordCardSense {
  index: number;
  meaning: string;
  gloss: string | null;
}

/**
 * The word card as a dictionary plate (G1): headword, IPA, part of speech with the gender as an
 * article rather than a label, numbered senses, and the sentence the reader actually met it in.
 * Save keeps it for review; the fold mark opens the full sheet in Discover.
 *
 * A guest sees every sense (J6); only the save slot changes, into the account ask in the same
 * shape. When no sense exists the primary action becomes the thing that can be done: write one.
 * No primary button on the card is ever disabled.
 */
@Component({
  selector: 'app-word-card',
  imports: [EmblemComponent],
  templateUrl: './word-card.component.html',
  styleUrl: './word-card.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordCardComponent implements OnChanges {
  @Input({required: true}) entry = '';
  @Input() context = '';
  @Input({required: true}) language: LanguageCode = LanguageCode.EN;
  @Input({required: true}) translationLanguage: LanguageCode = LanguageCode.EN;
  /** Where the sentence comes from: the book's title, shown under the quotation. */
  @Input() source = '';
  /** The library edition the word is being read in, so a saved word remembers where it was met. */
  @Input() sourceBookId: string | null = null;
  /** The book's level, shown beside the language in the kicker. */
  @Input() level: string | null = null;
  /** The form met in the text, when it differs from the entry; it is what the sentence marks. */
  @Input() highlight = '';
  /** The word was kept the moment the account existed: save once the lookup lands, no second tap. */
  @Input() autoSave = false;
  @Output() closed = new EventEmitter<void>();
  /** The entry that was just kept, so the list behind the card can mark it. */
  @Output() savedEntry = new EventEmitter<string>();

  private readonly discoverService = inject(DiscoverService);
  private readonly cardService = inject(CardService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly languageNameService = inject(LanguageNameService);
  private readonly router = inject(Router);
  private readonly returnPath = inject(ReturnPathService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  protected lookup: DiscoverLookup | null = null;
  protected loading = false;
  protected error = '';
  protected saving = false;
  protected saved = false;
  protected saveError = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entry'] || changes['language'] || changes['translationLanguage'] || changes['context']) {
      this.load();
    }
  }

  protected get signedIn(): boolean {
    return this.userInfoService.currentUserInfo !== null;
  }

  protected get languageLabel(): string {
    const name = this.languageNameService.getLanguageName(this.language);
    return this.level ? `${name} · ${this.level}` : name;
  }

  private get firstSense(): DiscoverSense | null {
    return this.lookup?.senses[0] ?? null;
  }

  /** The headword without its article, so the article can be set apart in plum. */
  protected get headword(): string {
    const raw = this.nonBlank(this.firstSense?.headword) ?? this.nonBlank(this.lookup?.entry) ?? this.entry;
    const article = this.article;
    return article ? raw.slice(article.length).trim() : raw;
  }

  protected get article(): string | null {
    const raw = this.firstSense?.headword ?? '';
    const [first, ...rest] = raw.split(/\s+/);
    if (rest.length === 0) return null;
    return first.toLowerCase() in ARTICLE_GENDERS ? first : null;
  }

  protected get transcription(): string | null {
    const value = this.firstSense?.transcription;
    if (!value) return null;
    const bare = value.replace(/^[/[]|[/\]]$/g, '');
    return `/${bare}/`;
  }

  /** "noun, fem." when the article tells us; the part of speech alone otherwise. */
  protected get partOfSpeech(): string | null {
    const pos = this.firstSense?.partOfSpeech;
    const gender = this.article ? ARTICLE_GENDERS[this.article.toLowerCase()] : null;
    if (!pos) return gender;
    return gender ? `${pos}, ${gender}` : pos;
  }

  protected get frequencyBand(): string | null {
    return this.lookup?.frequency?.band ?? null;
  }

  protected get senses(): WordCardSense[] {
    return (this.lookup?.senses ?? [])
      .filter(sense => sense.translations.length > 0)
      .map(sense => ({
        index: sense.index,
        meaning: sense.translations.join(', '),
        gloss: sense.headword && sense.headword !== this.firstSense?.headword ? sense.headword : null,
      }));
  }

  /** The sentence with the looked-up word marked, split so the template needs no innerHTML. */
  protected get contextParts(): {text: string; hit: boolean}[] {
    const context = this.nonBlank(this.lookup?.sourceContext) ?? this.context;
    if (!context) return [];
    const needle = (this.highlight || this.entry).trim();
    if (!needle) return [{text: context, hit: false}];
    let index = context.toLowerCase().indexOf(needle.toLowerCase());
    if (index < 0 && this.highlight) index = context.toLowerCase().indexOf(this.entry.trim().toLowerCase());
    if (index < 0) return [{text: context, hit: false}];
    return [
      {text: context.slice(0, index), hit: false},
      {text: context.slice(index, index + needle.length), hit: true},
      {text: context.slice(index + needle.length), hit: false},
    ].filter(part => part.text.length > 0);
  }

  /** Nothing to look up yet, nothing found, or nothing came back: the card has no sense to save. */
  protected get hasSense(): boolean {
    return this.senses.length > 0;
  }

  protected get saveLabel(): string {
    if (!this.signedIn) return $localize`Save to review — free account`;
    return this.saving ? $localize`Saving…` : $localize`Save to review`;
  }

  protected get writeLabel(): string {
    return this.signedIn ? $localize`Write a meaning` : $localize`Write a meaning — free account`;
  }

  private nonBlank(value: string | null | undefined): string | null {
    return value?.trim() ? value : null;
  }

  private load(): void {
    const entry = this.entry.trim();
    if (!entry) return;
    this.loading = true;
    this.error = '';
    this.saved = false;
    this.saveError = '';
    this.lookup = null;
    this.cdr.markForCheck();
    this.discoverService.lookup(entry, this.language, this.translationLanguage, this.context || undefined)
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      }), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: lookup => {
          this.lookup = lookup;
          if (this.autoSave && this.signedIn && this.hasSense) this.save();
        },
        error: error => this.error = getErrorMessage(error, $localize`This word could not be looked up. Try again.`),
      });
  }

  /** The auth sheet returns to this exact word, and the save happens without a second tap. */
  protected askForAccount(fragment: 'sign-up' | 'sign-in' = 'sign-up'): void {
    const tree = this.router.parseUrl(this.router.url);
    tree.queryParams = {...tree.queryParams, word: this.entry, context: this.context.slice(0, 300) || undefined, save: 1};
    this.returnPath.remember(this.router.serializeUrl(tree));
    void this.router.navigate(['/auth'], {fragment});
  }

  protected save(): void {
    if (!this.signedIn) {
      this.askForAccount();
      return;
    }
    const lookup = this.lookup;
    const meaning = this.senses[0]?.meaning ?? '';
    if (!lookup || !meaning || this.saving || this.saved) return;
    const sense = lookup.senses[0];
    const context = this.nonBlank(lookup.sourceContext) ?? this.nonBlank(this.context);
    this.saving = true;
    this.saveError = '';
    this.cdr.markForCheck();
    this.cardService.createCard({
      entry: lookup.entry,
      language: lookup.language,
      translations: meaning.split(',').map(value => value.trim()).filter(Boolean).map(translation => ({translation})),
      partOfSpeech: sense?.partOfSpeech ?? undefined,
      selectedSense: sense ? `${sense.index}: ${meaning}` : meaning,
      sourceContext: context ?? undefined,
      sourceBookId: this.sourceBookId ?? undefined,
      learningIntents: ['UNDERSTAND'],
      itemType: lookup.entry.includes(' ') ? 'PHRASE' : 'WORD',
      examples: context ? [{example: context, translation: ''}] : [],
      activeLearning: true,
      learnt: false,
      priority: 0,
    }).pipe(finalize(() => {
      this.saving = false;
      this.cdr.markForCheck();
    }), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saved = true;
        this.savedEntry.emit(lookup.entry);
      },
      error: error => this.saveError = getErrorMessage(error, $localize`The word could not be saved. Please try again.`),
    });
  }

  /** The fold: many becoming one. It opens the full sheet, where the reader chooses senses and intents. */
  protected openInDiscover(): void {
    void this.router.navigate(['/discover'], {queryParams: {text: this.entry, context: this.context || undefined}});
  }

  /** With no sense to save, the full sheet is where a meaning gets written; it needs an account too. */
  protected writeMeaning(): void {
    if (!this.signedIn) {
      this.askForAccount();
      return;
    }
    this.openInDiscover();
  }
}
