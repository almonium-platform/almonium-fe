import {Pipe, PipeTransform, inject} from '@angular/core';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';

import {sanitizeBookHtml} from './book-html-sanitizer';

/** Marks already allowlisted book markup as safe for Angular's HTML renderer. */
@Pipe({
  name: 'bookHtml',
  standalone: true,
})
export class BookHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(sanitizeBookHtml(value ?? ''));
  }
}
