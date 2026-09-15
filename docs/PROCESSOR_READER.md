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

The real paid Frankenstein preview is staff-only in the processor until editorial
publication. It covers `c11.p2`, `c11.p13`, `c11.p20` in both adaptation/original
and adaptation/Ukrainian pairs. Nothing was published for testing.

The Angular browser integration test uses intercepted HTTP responses (no paid
calls, no publication or authentication bypass in application code):

```bash
npm run build -- --configuration development
E2E_DIST=dist/almonium-fe/browser E2E_PORT=4201 node node_modules/@playwright/test/cli.js test e2e/processor-parallel.spec.ts
```

Add `--headed` to watch it. The Node invocation works around this checkout's
non-executable Playwright CLI shim. The ordinary production-config E2E server
currently fails the unchanged `ops.component.less` size budget (16.81 kB versus
16 kB); the development build and reader tests pass. Do not claim a production
build or live frontend/backend deployment was verified here.

Next: approve/publish an honest-level edition and test against the live backend;
then typed chapter metadata/difficulty/vocabulary, eligible-pair discovery and
clearer source/review labels; then chapter-wide sentence and clause highlighting.
The existing backend HTML adapter is still used—this iteration does not pretend
all processor artifacts already reach the app.
