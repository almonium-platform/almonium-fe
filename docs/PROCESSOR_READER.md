# Processor edition reader — 2026-09-15

Book-page chips and the reader companion picker now address an **edition slug**,
not a language. Labels distinguish language, level and edition type. Same-language
original/adaptation pairs work in side-by-side, inline and overlay modes.
Reader-position keys include the companion edition rather than only its language.

Deep link: `/reader/{primarySlug}?parallel={companionSlug}`.
The API is `/public/books/{primarySlug}/parallel-edition/{companionSlug}`.
Processor content remains behind the backend; no browser processor credentials.

In side-by-side mode click an aligned sentence, or focus it and press Enter, to
highlight every matching sentence on both sides. Many-to-one and many-to-many
groups are supported. Plain paragraphs mean finer alignment is unavailable, not
that sentences pair by position. Text is sanitized; side identity is independent
of language. The companion may translate the original rather than the adaptation.

## Check it

The real Frankenstein B2 preview is staff-only until editorial publication.
Both complete 815-block pairs now have offline sentence correspondences; the
three-block paid pilot is historical, not the current coverage limit. Nothing
was published for testing.

The Angular browser integration test uses intercepted HTTP responses (no paid
calls, no publication or authentication bypass in application code):

```bash
npm run build -- --configuration development
E2E_DIST=dist/almonium-fe/browser E2E_PORT=4201 node node_modules/@playwright/test/cli.js test e2e/processor-parallel.spec.ts
```

Add `--headed` to watch it. The Node invocation works around this checkout's
non-executable Playwright CLI shim. As of 2026-09-16, full lint, 267 tests,
production build and seven browser checks (six pair/mode cases plus a full
chapter-list regression) pass. Browser pair tests use
intercepted fixtures; they do not prove publication of the real B2/UK editions.
Screenshots, including the companion switch, are in `docs/evidence/reader-20260916`.

Next: the owner reviews fidelity and decides publication, then test those real
editions against the live backend. Chapter metadata and full-book sentence
highlights and chapter vocabulary are implemented; clause highlighting remains future work.
The existing backend HTML adapter is still used—this iteration does not pretend
all processor artifacts already reach the app.
# Chapter information (2026-09-15)

The reader fetches `/public/books/{editionSlug}/chapters` independently of book
text. Existing chapter anchors join metadata by processor chapter sequence, not
array index or translated title. The sidebar and chapter dropdown show estimated
CEFR and spoiler-free descriptions. Missing/failed enrichment keeps normal text
navigation. Edition-level editorial CEFR is unchanged. Private imports do not
call the public enrichment endpoint. Mobile now consumes this same enrichment
optionally alongside local heading-based navigation.
# Sentence interaction parity (2026-09-16)

Marked sentence groups highlight in side-by-side, inline and overlay modes.
Existing text selections take precedence over click highlighting/overlay toggling.
The processor's full-book offline matcher now supplies genuine 1:N/N:1 groups;
uncertain passages stay paragraph-aligned. No browser request runs an AI job.

Adaptations include translations of other editions by default. The companion
menu explicitly labels indirect translations and lets the reader hide them;
hiding the active one returns to base reading. This is a product default for
the owner to evaluate, not an editorial approval. Chapter and companion menus
close each other rather than overlapping.
The desktop contents list scrolls without shrinking/clipping enriched chapter
rows. The regression uses 30 chapters; this was also checked on the live original.

## Chapter vocabulary (2026-09-16)

Open `/reader/shelley-frankenstein-en-orig`, choose **Vocabulary** in the bottom
bar, then **11 — CHAPTER V.** There are 21 selected words, with lemmas, observed
forms and source excerpts. The chapter picker is independent of reading position.
This is a chapter-filtered selection from the book's useful words, not an exhaustive
word list. Only current processor artifacts are displayed; missing/stale analysis
does not block reading. Private imports do not use this public endpoint.

The lazy request is `/public/books/{editionSlug}/chapters/{sequence}/vocabulary`.
Discover links carry lemma, context, source language, edition slug, chapter and
block identity. The source language overrides the lookup language without changing
the learner's preference. Discover shows the book/chapter and a **Back to book**
link (not a chapter-position jump).

Verification: lint, 274 unit tests, production build and eight browser tests pass.
`e2e/chapter-vocabulary.spec.ts` tests the reader-to-Discover journey with fixtures,
including a different learner language. No paid provider calls are made by tests.
[Live original vocabulary](evidence/reader-20260916/vocabulary-live-original.png)
was checked against the actual backend; [Discover context](evidence/reader-20260916/discover-book-context.png)
is fixture evidence. Mobile vocabulary remains a separate slice.
