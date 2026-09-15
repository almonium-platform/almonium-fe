import {ChangeDetectorRef, Component, Input, OnChanges, inject} from '@angular/core';
import {BookHue, bookColor, dominantBookHue, hashedBookHue} from '../book-hue';

@Component({
  selector: 'app-book-cover',
  templateUrl: './book-cover.component.html',
  styleUrl: './book-cover.component.less',
})
export class BookCoverComponent implements OnChanges {
  @Input({required: true}) title = '';
  @Input({required: true}) author = '';
  @Input({required: true}) workSlug = '';
  @Input() coverUrl: string | null = null;

  private readonly cdr = inject(ChangeDetectorRef);

  protected get coverLabel(): string {
    return $localize`${this.title}:title: by ${this.author}:author: cover`;
  }

  protected imageFailed = false;
  /** One of the eight shelf hues: sampled from the cover art when it can be read, hashed from the work otherwise. */
  protected hue: BookHue = hashedBookHue('');

  protected get color(): string {
    return bookColor(this.hue);
  }

  ngOnChanges(): void {
    this.imageFailed = false;
    this.hue = hashedBookHue(this.workSlug);
    const url = this.coverUrl;
    if (!url) return;
    void dominantBookHue(url).then(sampled => {
      if (sampled === null || url !== this.coverUrl) return;
      this.hue = sampled;
      this.cdr.markForCheck();
    });
  }

  protected onImageError(): void {
    this.imageFailed = true;
  }
}
