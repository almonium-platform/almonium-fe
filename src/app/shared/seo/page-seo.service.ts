import {DOCUMENT, Injectable, inject} from '@angular/core';
import {Meta, Title} from '@angular/platform-browser';
import {environment} from '../../../environments/environment';

/** What a public page tells search engines and link previews about itself (docs/SEO.md). */
export interface PageDescription {
  title: string;
  description: string;
  /** The app path this page is canonically found at, without a query: "/books/the-hobbit-en/3". Absent for a
   * page only its owner can open, which gets a title and nothing a crawler would follow. */
  path?: string;
  image?: string | null;
  /** A schema.org object; "@context" is added here. */
  structuredData?: Record<string, unknown>;
}

const DEFAULT_TITLE = 'Almonium';
const OPEN_GRAPH = ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:url', 'og:image'];

/**
 * One owner for the head tags a public page sets, so the canonical link, Open Graph and JSON-LD a page adds are
 * taken away again when the reader leaves it rather than lingering on the next page.
 */
@Injectable({providedIn: 'root'})
export class PageSeoService {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private canonical: HTMLLinkElement | null = null;
  private structuredData: HTMLScriptElement | null = null;

  /** The page's absolute URL on the environment's own domain, which is what the sitemap lists. */
  static url(path: string): string {
    return `${environment.feUrl}${path}`;
  }

  describe(page: PageDescription): void {
    this.title.setTitle(page.title);
    this.meta.updateTag({name: 'description', content: page.description});
    if (page.path === undefined) {
      this.clearLinkedData();
      return;
    }
    const url = PageSeoService.url(page.path);
    this.meta.updateTag({property: 'og:type', content: 'website'});
    this.meta.updateTag({property: 'og:site_name', content: 'Almonium'});
    this.meta.updateTag({property: 'og:title', content: page.title});
    this.meta.updateTag({property: 'og:description', content: page.description});
    this.meta.updateTag({property: 'og:url', content: url});
    if (page.image) this.meta.updateTag({property: 'og:image', content: page.image});
    else this.meta.removeTag("property='og:image'");

    this.canonical ??= this.document.head.appendChild(this.document.createElement('link'));
    this.canonical.rel = 'canonical';
    this.canonical.href = url;

    this.structuredData?.remove();
    this.structuredData = null;
    if (page.structuredData) {
      const script = this.document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify({'@context': 'https://schema.org', ...page.structuredData});
      this.structuredData = this.document.head.appendChild(script);
    }
  }

  clear(): void {
    this.title.setTitle(DEFAULT_TITLE);
    this.meta.removeTag("name='description'");
    this.clearLinkedData();
  }

  private clearLinkedData(): void {
    for (const property of OPEN_GRAPH) this.meta.removeTag(`property='${property}'`);
    this.canonical?.remove();
    this.canonical = null;
    this.structuredData?.remove();
    this.structuredData = null;
  }
}
