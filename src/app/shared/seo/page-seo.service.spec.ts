import {DOCUMENT} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {environment} from '../../../environments/environment';
import {PageSeoService} from './page-seo.service';

describe('PageSeoService', () => {
  let seo: PageSeoService;
  let document: Document;

  const canonical = () => document.head.querySelectorAll('link[rel="canonical"]');
  const jsonLd = () => document.head.querySelectorAll('script[type="application/ld+json"]');
  const meta = (selector: string) => document.head.querySelector<HTMLMetaElement>(`meta[${selector}]`)?.content;

  beforeEach(() => {
    seo = TestBed.inject(PageSeoService);
    document = TestBed.inject(DOCUMENT);
  });

  afterEach(() => seo.clear());

  it('gives a public page one canonical link, Open Graph tags and JSON-LD on the environment domain', () => {
    seo.describe({title: 'A', description: 'first', path: '/books/a-en', structuredData: {'@type': 'Book'}});
    seo.describe({title: 'B', description: 'second', path: '/books/b-en', image: 'https://img/b.png', structuredData: {'@type': 'Book', name: 'B'}});

    expect(document.title).toBe('B');
    expect(canonical().length).toBe(1);
    expect((canonical()[0] as HTMLLinkElement).href).toBe(`${environment.feUrl}/books/b-en`);
    expect(meta('name="description"')).toBe('second');
    expect(meta('property="og:url"')).toBe(`${environment.feUrl}/books/b-en`);
    expect(meta('property="og:image"')).toBe('https://img/b.png');
    expect(jsonLd().length).toBe(1);
    expect(JSON.parse(jsonLd()[0].textContent ?? '')).toEqual({'@context': 'https://schema.org', '@type': 'Book', name: 'B'});
  });

  it('keeps a page without a public path out of what crawlers follow', () => {
    seo.describe({title: 'A', description: 'first', path: '/books/a-en', structuredData: {'@type': 'Book'}});
    seo.describe({title: 'Mine', description: 'private'});

    expect(document.title).toBe('Mine');
    expect(canonical().length).toBe(0);
    expect(jsonLd().length).toBe(0);
    expect(meta('property="og:url"')).toBeUndefined();
  });

  it('leaves nothing behind for the next page', () => {
    seo.describe({title: 'A', description: 'first', path: '/books/a-en', image: 'x', structuredData: {'@type': 'Book'}});
    seo.clear();

    expect(document.title).toBe('Almonium');
    expect(canonical().length).toBe(0);
    expect(jsonLd().length).toBe(0);
    expect(meta('name="description"')).toBeUndefined();
    expect(meta('property="og:title"')).toBeUndefined();
  });
});
