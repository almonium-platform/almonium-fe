import {SecurityContext} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {DomSanitizer} from '@angular/platform-browser';

import {BookHtmlPipe} from './book-html.pipe';

describe('BookHtmlPipe', () => {
  it('keeps chapter anchors after sanitizing reader HTML', () => {
    TestBed.configureTestingModule({});
    const pipe = TestBed.runInInjectionContext(() => new BookHtmlPipe());
    const sanitizer = TestBed.inject(DomSanitizer);
    const html = sanitizer.sanitize(
      SecurityContext.HTML,
      pipe.transform('<section class="chapter"><h2 class="chapter-title" id="chapter-0">Chapter 1</h2></section><script>bad()</script>'),
    );
    const document = new DOMParser().parseFromString(html ?? '', 'text/html');

    expect(document.querySelector('section.chapter > h2#chapter-0')?.textContent).toBe('Chapter 1');
    expect(document.querySelector('script')).toBeNull();
  });
});
