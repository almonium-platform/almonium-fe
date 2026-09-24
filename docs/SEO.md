# Search engines: books and chapters

**Last updated:** 2026-09-24
**Backlog it tracks:** `../almonium-be/docs/ALMONIUM_BACKLOG.md` items 2.1 (server-rendered
public pages) and 2.2 (sitemap, canonical URLs, Book markup).

The public catalogue is the acquisition surface: `/books/{editionSlug}` (the book
page) and `/books/{editionSlug}/{sequence}` (a chapter in the reader). Both are
public routes with no login wall. This document says what is in place, how to
check it, and what to do next, in order.

## Decision so far

- **Foundation now, SSR later.** The sitemap, robots.txt, canonical URLs and
  JSON-LD work with the client-rendered app, and every book added later shows up
  in the sitemap without any further work. Googlebot renders JavaScript, in a
  delayed second pass; Bing, most AI crawlers and link previews mostly do not.
- **SSR waits** until the book and reader pages stop changing weekly, or until
  Search Console shows chapters not being indexed (see step 5 below). The cost of
  SSR does not grow with the number of books, so waiting costs nothing.
- **Content that ranks is ours, not Gutenberg's.** Bare public-domain chapter
  text is duplicate content. The companion translation, CEFR level, chapter
  descriptions and word lists are what only Almonium has; they must be in the
  rendered page.

## What is in place

| Piece | Where | Behaviour |
|---|---|---|
| Sitemap | `almonium-be` `SitemapOpenController` + `BookSitemapService` at `GET /api/v1/public/sitemap.xml` | Public pages (`/`, `/read`, `/discover`, `/play`, `/pricing`, legal), every catalogue book, and each chapter by its **processor sequence** (not 1..n; a book can start at chapter 11). One processor call per book; a book whose chapters fail lists its page only. Withdrawn books are excluded by the entity. URLs use `app.web-domain`. HTTP cache 1 h. |
| `/sitemap.xml` on the app domain | `almonium-infra` `nginx-configs/spa.conf` (copied to this repo's `nginx.conf`) | Proxied to the API of the same environment, like the certificate routes. |
| `robots.txt` | `public/robots.txt` (production), nginx (staging) | Production: disallows signed-in areas, private reader, shared links, profiles; points at the sitemap. Staging: nginx answers `Disallow: /`. |
| Staging noindex | `spa.conf` | Every staging response carries `X-Robots-Tag: noindex, nofollow`. Other hosts sharing the file (famsub) are untouched. |
| Head tags | `src/app/shared/seo/page-seo.service.ts` | One owner for title, description, canonical link, Open Graph and JSON-LD; `clear()` on leaving the page. Canonical/`og:url` use `environment.feUrl` and drop the query (`?parallel=` companion), so each chapter is one page to a search engine. |
| Book page | `sections/read/book/book.component.ts` | schema.org `Book`: name, author, description, `inLanguage`, `educationalLevel` (CEFR), cover. |
| Chapter page | `sections/read/reader/reader.component.ts` | schema.org `Chapter` with `position`, `url`, `isPartOf` Book. Private imports (`/reader/private/…`) get a title only: no canonical, no JSON-LD. |
| Default description | `src/index.html` | For pages that set none, and for crawlers that run no JavaScript. |
| Tests | `page-seo.service.spec.ts`, `e2e/chapter-vocabulary.spec.ts`, `BookSitemapServiceTest` | Canonical, JSON-LD and clean-up across book → chapter → chapter navigation. |

Not verified before the first deploy: the sitemap endpoint against a running
backend and processor (the local backend was down; the service is unit-tested and
the nginx proxy was tested in a container against production's API, which
returned 404 because the endpoint was not yet deployed).

## Checklist after deploy

1. `curl -s https://staging.almonium.com/robots.txt` shows `Disallow: /`, and
   `curl -sI https://staging.almonium.com/books/x | grep -i x-robots` shows noindex.
2. `curl -s https://almonium.com/robots.txt` shows the production file with the
   `Sitemap:` line.
3. `curl -s https://almonium.com/sitemap.xml | head` lists books **and** chapter
   URLs. If a book has no chapter URLs, the backend log has
   `Sitemap lists {slug} without chapters`.
4. Open a book and a chapter, inspect `<head>`: one `link[rel=canonical]`, one
   `application/ld+json`. Paste the URL into
   <https://search.google.com/test/rich-results>.

## Backlog, in order

### 1. Google Search Console (owner, ~30 min) — do first

- Add the **domain property** `almonium.com` (DNS TXT record at Porkbun; this
  covers every subdomain and protocol).
- Submit `https://almonium.com/sitemap.xml`.
- URL Inspection → *Test live URL* on one book page and one chapter page. The
  rendered HTML screenshot answers whether client rendering is enough.
- Do the same in Bing Webmaster Tools (it can import from Search Console); Bing
  also feeds DuckDuckGo and several AI assistants.

### 2. Real "not found" for missing books (S)

A missing book currently shows an alert on an empty page with HTTP 200, a
"soft 404". Do what the certificate page does: navigate to `/404` with
`skipLocationChange` on a 404 from `getPublicBook`, and have the not-found
component add `<meta name="robots" content="noindex">`. A true 404 status needs
SSR (step 5).

### 3. Richer pages and markup (S–M)

- Landing (`/`) and catalogue (`/read`) through `PageSeoService.describe`, so
  they carry canonical and Open Graph tags too (the landing page is the most
  important page).
- Book JSON-LD `hasPart` with the chapter list, and `workExample`/`translationOfWork`
  between editions of one work (`workSlug`).
- `hreflang` alternates between the language editions of one work, both in the
  head and in the sitemap (`xhtml:link`).
- `og:image` for the book page: the cover exists, but a generated 1200×630 card
  (as `CertificateImageRenderer` does) unfurls better.
- Make sure the chapter descriptions, level estimate and chapter words render as
  text on the chapter page (they do today; keep it that way when redesigning).

### 4. Sitemap at scale (S, when the catalogue grows)

- Today each sitemap request makes one processor call per book. Past a few dozen
  books, cache the result (Caffeine, ~1 h) or have the processor publish chapter
  sequences with the edition so the backend stores them.
- `<lastmod>` needs a real `updatedAt` on `Book`; do not fake it (Google ignores
  sitemaps whose lastmod is always "now").
- Past 50,000 URLs, split into a sitemap index.

### 5. Hybrid SSR for `/books/**` (L) — backlog 2.1

**When:** the book/reader pages are stable, and either Search Console shows
chapters stuck in *Discovered – currently not indexed* / *Crawled – currently
not indexed*, or Bing/AI-crawler traffic matters.

**Shape:** `ng add @angular/ssr`, then in `app.routes.server.ts`
`RenderMode.Server` for `books/:slug` and `books/:slug/:sequence`, and
`RenderMode.Client` for `**`. Everything else stays a client app.

**Work it involves:**

- *Browser-only code on those routes* must not run on the server: guard with
  `isPlatformBrowser` or move to `afterNextRender`. Known suspects:
  `ReaderPositionStorage` and other `localStorage` use, `ReaderDomService`,
  scroll/resize listeners in the reader, `matchMedia`, Firebase initialisers in
  `app.config.ts`/`initializers/`, Stream chat, `gtag`. The inline theme script
  in `index.html` is fine (it runs in the browser only).
- *Data:* the public book, chapters and text endpoints need no cookies or CSRF;
  use `HttpClient` with `withFetch()` and let `TransferState` (default HTTP
  transfer cache) stop the browser from fetching them again.
- *Status codes:* `RESPONSE_INIT` gives a real 404 for a missing book.
- *i18n:* runtime `$localize` must load the right locale per request on the
  server (see the i18n memory/README note).
- *Deploy:* the container becomes a Node server (Angular's `server.mjs`), or
  nginx in front of it for static assets. That changes this repo's `Dockerfile`
  and the infra `services/almonium-fe` Compose file and `spa.conf`; memory on the
  ARM64 host goes up by one Node process per environment.
- *Alternative:* build-time prerendering (`RenderMode.Prerender` +
  `getPrerenderParams` reading the catalogue) keeps nginx static, but needs a
  rebuild for every new book and makes the image grow with the chapter count.
  Fine for book pages, a stretch for chapters.
- *Stop-gap if needed before SSR:* the certificate pattern (nginx hands known
  crawlers a bare HTML page from the API) works for books too, but Google calls
  it a workaround, and the two versions must say the same thing.

### 6. Content that only Almonium has (ongoing) — backlog 2.3

"50 useful words from *Book*" pages and similar, built from the processor's
artifacts. These can rank where the bare text cannot.
