import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject} from '@angular/core';
import {Subscription} from 'rxjs';
import {SharedLucideIconsModule} from '../../../shared/shared-lucide-icons.module';
import {BookChapter, displayChapterTitle} from '../book-chapter.model';
import {ChapterVocabulary, ChapterWord, wordExcerpt} from '../chapter-vocabulary.model';
import {ReadService} from '../read.service';

/** How many rows the chapter end shows before "All N words" opens the rest in place. */
const END_PREVIEW_ROWS = 5;

/**
 * The words from a chapter (J3, J4): a curated selection of the book's useful words that occur in
 * it, each with the sentence it was met in. As the right rail it follows the chapter being read and
 * can look ahead or back; at the chapter end it is revision, five rows and then the rest in place.
 * A row is one target: it opens the word's card, never a page.
 */
@Component({
  selector: 'app-chapter-vocabulary',
  imports: [SharedLucideIconsModule],
  templateUrl: './chapter-vocabulary.component.html',
  styleUrl: './chapter-vocabulary.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChapterVocabularyComponent implements OnChanges, OnDestroy {
  @Input({required: true}) editionSlug = '';
  /** The chapter the list follows: the one being read. */
  @Input({required: true}) sequence = 0;
  @Input() chapters: BookChapter[] = [];
  @Input() variant: 'rail' | 'end' = 'end';
  /** Entries already kept for review, lower-cased; a member's "Saved" marks. */
  @Input() savedEntries: ReadonlySet<string> = new Set();
  @Output() wordPicked = new EventEmitter<ChapterWord>();
  @Output() closed = new EventEmitter<void>();

  /** The chapter the list currently shows; the rail's arrows move it without moving the text. */
  protected shown = 0;
  protected expanded = false;
  protected loading = false;
  protected failed = false;
  protected vocabulary: ChapterVocabulary | null = null;
  private readonly service = inject(ReadService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private request?: Subscription;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editionSlug'] || changes['sequence']) {
      this.shown = this.sequence;
      this.expanded = false;
      this.load();
    }
  }

  ngOnDestroy(): void { this.request?.unsubscribe(); }

  protected get shownChapter(): BookChapter | null {
    return this.chapters.find(chapter => chapter.sequence === this.shown) ?? null;
  }

  protected get shownTitle(): string {
    const chapter = this.shownChapter;
    return chapter ? displayChapterTitle(chapter.title) : $localize`Chapter ${this.shown}:number:`;
  }

  private get shownIndex(): number {
    return this.chapters.findIndex(chapter => chapter.sequence === this.shown);
  }

  protected get hasPrevious(): boolean { return this.shownIndex > 0; }
  protected get hasNext(): boolean { const index = this.shownIndex; return index >= 0 && index < this.chapters.length - 1; }

  protected get words(): ChapterWord[] {
    return this.vocabulary?.status === 'ready' ? this.vocabulary.words : [];
  }

  protected get visibleWords(): ChapterWord[] {
    return this.variant === 'end' && !this.expanded ? this.words.slice(0, END_PREVIEW_ROWS) : this.words;
  }

  protected get hiddenCount(): number {
    return this.variant === 'end' && !this.expanded ? Math.max(0, this.words.length - END_PREVIEW_ROWS) : 0;
  }

  /** The block is absent, not disabled, when the chapter has no vocabulary artifact at all. */
  protected get unavailable(): boolean {
    return this.vocabulary?.status === 'unavailable';
  }

  protected get notReady(): boolean {
    return this.vocabulary !== null && (this.vocabulary.status === 'pending' || this.vocabulary.status === 'stale');
  }

  protected excerpt(word: ChapterWord) { return wordExcerpt(word); }
  protected showsForm(word: ChapterWord): boolean { return word.surface.trim().toLowerCase() !== word.lemma.trim().toLowerCase(); }
  protected isSaved(word: ChapterWord): boolean { return this.savedEntries.has(word.lemma.trim().toLowerCase()); }

  protected step(direction: -1 | 1): void {
    const next = this.chapters[this.shownIndex + direction];
    if (!next) return;
    this.shown = next.sequence;
    this.load();
  }

  protected load(): void {
    this.request?.unsubscribe();
    this.vocabulary = null;
    this.failed = false;
    if (!this.editionSlug || !this.shown) { this.loading = false; return; }
    this.loading = true;
    const sequence = this.shown;
    this.request = this.service.getChapterVocabulary(this.editionSlug, sequence).subscribe({
      next: data => {
        if (sequence !== this.shown) return;
        this.loading = false;
        if (data.chapterSequence !== sequence) this.failed = true;
        else this.vocabulary = data;
        this.changeDetector.markForCheck();
      },
      error: () => {
        if (sequence !== this.shown) return;
        this.failed = true;
        this.loading = false;
        this.changeDetector.markForCheck();
      },
    });
  }
}
