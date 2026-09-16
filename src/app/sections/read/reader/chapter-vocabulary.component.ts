import {ChangeDetectorRef, Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {Subscription} from 'rxjs';
import {BookChapter} from '../book-chapter.model';
import {ChapterVocabulary, ChapterWord, vocabularyDiscoverParams} from '../chapter-vocabulary.model';
import {ReadService} from '../read.service';

@Component({
  selector: 'app-chapter-vocabulary',
  imports: [FormsModule, RouterLink],
  templateUrl: './chapter-vocabulary.component.html',
  styleUrl: './chapter-vocabulary.component.less',
})
export class ChapterVocabularyComponent implements OnChanges, OnDestroy {
  @Input({required: true}) editionSlug = '';
  @Input() bookTitle = '';
  @Input() chapterMetadata: Record<string, BookChapter> = {};
  @Output() opened = new EventEmitter<void>();
  protected open = false;
  protected sequence = 0;
  protected loading = false;
  protected failed = false;
  protected vocabulary: ChapterVocabulary | null = null;
  private readonly service = inject(ReadService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private request?: Subscription;

  protected get chapters(): BookChapter[] {
    return Object.values(this.chapterMetadata).sort((a, b) => a.sequence - b.sequence);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editionSlug']) {
      this.close();
      this.sequence = 0;
      this.vocabulary = null;
    }
    if (this.open && !this.sequence && this.chapters.length) {
      this.sequence = this.chapters[0].sequence;
      this.load();
    }
  }

  ngOnDestroy(): void { this.request?.unsubscribe(); }

  protected toggle(): void {
    if (this.open) { this.close(); return; }
    this.open = true;
    this.opened.emit();
    this.sequence ||= this.chapters[0]?.sequence ?? 0;
    if (this.sequence) this.load();
  }

  @HostListener('document:keydown.escape')
  close(): void { this.open = false; this.request?.unsubscribe(); }

  protected load(): void {
    this.request?.unsubscribe();
    this.vocabulary = null;
    this.failed = false;
    this.loading = true;
    const sequence = this.sequence;
    this.request = this.service.getChapterVocabulary(this.editionSlug, sequence).subscribe({
      next: data => {
        this.loading = false;
        this.changeDetector.markForCheck();
        if (data.chapterSequence !== sequence) { this.failed = true; return; }
        this.vocabulary = data;
      },
      error: () => { this.failed = true; this.loading = false; this.changeDetector.markForCheck(); },
    });
  }

  protected discoverParams(word: ChapterWord) {
    return vocabularyDiscoverParams(word, this.vocabulary!, this.editionSlug, this.bookTitle,
      this.chapters.find(chapter => chapter.sequence === this.sequence)?.title ?? String(this.sequence));
  }
}
