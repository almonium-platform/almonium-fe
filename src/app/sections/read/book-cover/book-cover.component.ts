import {Component, Input, OnChanges} from '@angular/core';

const COVER_COLORS = [
  '#6f405c',
  '#315c62',
  '#8a543f',
  '#4f5f3d',
  '#5a4b78',
  '#9a6a33',
] as const;

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

  protected imageFailed = false;
  protected color: string = COVER_COLORS[0];

  ngOnChanges(): void {
    this.imageFailed = false;
    this.color = COVER_COLORS[this.hash(this.workSlug) % COVER_COLORS.length];
  }

  protected onImageError(): void {
    this.imageFailed = true;
  }

  private hash(value: string): number {
    let result = 2166136261;
    for (const character of value) {
      result ^= character.charCodeAt(0);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }
}
