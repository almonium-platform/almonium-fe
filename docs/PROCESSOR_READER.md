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

## Chapter pages (2026-09-16, design J)

The public reader is now one page per chapter. `/books/{editionSlug}/{sequence}`
opens a chapter; `/reader/{editionSlug}` is the front door and redirects to the
chapter kept on this device, else to the first chapter with `?resume=1`, which a
signed-in reader's server percentage then resolves to the right chapter. Private
imports follow the same shape at `/reader/private/{id}/{sequence}`.
`?parallel={companionSlug}` still works and travels with page turns. The book is
still fetched whole and split client-side by `section.chapter`; there is no
server rendering in this SPA, so the title, description and the schema.org
Chapter JSON-LD are set in the browser.

What a chapter page carries: book · author (a link), "Chapter n of N ·
Estimated X" in mono, the title in Literata with the source's trailing full
stop and shouting caps normalised for display, the descriptions as one
paragraph, the text under a hairline, then the chapter's words (five rows, then
"All N words" in place), previous/next (next with level and description) and,
for a guest, one account panel. The contents rail shows title plus level per
row; the description shows on the current row and on hover, unfolding and
fading in over 220ms after a short beat, so a sweep across the rows does not
flicker and the row you leave folds as the next one opens. The bottom bar has
two toggles, Contents and Words, at the left. Vocabulary and the word card share
one right rail; a row opens the card with a "← Words" way back. `unavailable`
removes the Words toggle; pending/stale shows one grey line.

Guests get the whole page, every sense and the whole word list. Only keeping
asks for an account: the save slot becomes "Save to review — free account" and
returns to the same word with `?word=&context=&save=1`, after which the card
saves without a second tap. No primary button on the card is ever disabled; with
no sense, the primary becomes "Write a meaning".

Reading positions changed shape (version 2, one place per book, with the
chapter) and older bookmarks are ignored, not migrated. Server progress stays a
whole-book percentage, mapped to a chapter by chapter text length; the book
page's Continue row is pinned from this device's place only. The public chapter
projection has no front/back-matter role yet, so the book page treats every
chapter as a body chapter.

Ground (2026-09-17 revision of J2/J3): the chapter page is the cream page
ground, the same paper as the navbar, with no card under the text. White is
only for what floats: the word card, the Words rail, the bottom bar (a pill),
the chapter-end account panel and the contents rail's current-row pill.
Hairlines on cream use `--hairline-on-ground` (#e6dfdb); `--hairline-color`
(#edebe8) stays for hairlines inside white cards. The contents rail shows the
description on the current row and on a hovered row; the live Frankenstein
edition has every chapter `stale` with no descriptions, so that is visible only
in the fixture screenshot `contents-rail-descriptions.png`.

Verification: 290 unit tests, lint and a development build pass; 11 browser
tests with intercepted fixtures pass (`e2e/chapter-vocabulary.spec.ts` covers
the guest chapter page, the rail, the card ask and the book contents;
`e2e/processor-parallel.spec.ts` the rail with 30 chapters and the companion
modes). Against the live backend, the front door resumed a member at chapter 22
from 59 % server progress, the rail listed 31 words for it and Next turned to
chapter 23. Screenshots in `docs/evidence/chapters-20260916`.

## Parallel text at sentence level (2026-09-17, design L)

Alignment is invisible until you ask. Sentence spans and paragraph runs have
no paint at rest; the unit under the pointer or focus (a sentence group, or
the whole paragraph pair where no group exists) takes the word-card tint
(`--parallel-tint`) on both sides at once, and a click or Enter keeps the tint
and adds a 2px plum rule under the run. The same unit again, Esc, or a click
away clears it. The yellow fill and the plum outline are gone.

The modes are `side`, `demand` (renamed from `overlay`) and `inline`;
`demand` is the default everywhere and a stored `overlay` falls back to it.

- **Side by side** is one CSS grid per chapter with a primary and a companion
  cell per block, so paragraph pairs stay level without the old JavaScript
  height sync. It needs a 1100px window: below that the row is absent from
  the picker, one line says why, and the reader lays the text out on demand
  until the window widens.
- **On demand** keeps the companion in the DOM, hidden, and opens one block
  right after the group's last sentence, so the paragraph splits there and
  continues under the block, with only the group's companion sentences (the
  whole companion paragraph where the paragraph is the unit); it slides open
  in 160ms and snaps under reduced motion (`demand-split.png`).
- **Inline** interleaves each sentence group with its companion as a grey
  16px run in the same flow; a paragraph without groups is followed by its
  companion paragraph.

The two provenance paragraphs above the text are gone. The chapter header
has a fourth line while a companion is open: the codes in mono, an arrow,
the companion's language and kind in words ("machine translation",
"adaptation", "original", "translation of the original" for an indirect
one), and the mode as a plum link that opens the picker. Below 640px the
words drop and the codes stay. The picker is rows, not cards, with a
companion line and a Change link into the companion menu; the bar's
companion button is a filled plum circle with the companion's code while
one is open and opens the picker, or the menu when none is. On a phone
(under 600px) the picker is one sheet that also lists the editions and
"Read without a companion".

Verification: 294 unit tests, a development build, eslint on the changed
files and ten browser tests with intercepted fixtures pass
(`e2e/processor-parallel.spec.ts` covers hover, selection, Esc, the on-demand
block, the pair line, the picker, the phone sheet and the width fallback).
Screenshots in `docs/evidence/parallel-20260917`. Not checked against the
live backend: it still has no published pair.
