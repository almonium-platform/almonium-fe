# Discover implementation and dependency log

This iteration turns `/discover` into the first working creation path for the
server-owned learning items used by Review. It follows the interaction and
visual direction in `Almonium Discover.dc.html`, while exposing missing data
honestly instead of filling the sheet with mock lexical content.

## Implemented

- Public word or phrase lookup through `GET /api/v1/public/discover/lookup/{language}/{translationLanguage}`.
- A sentence-paste state where each token can open a word sheet and the source
  sentence travels with the lookup.
- Structured dictionary senses when the configured translation provider returns
  them, including part of speech and transcription.
- Corpus-frequency band, relative score, and `ngrams.dev` corpus provenance for
  the currently supported English, German, and Russian corpora.
- Signed-in sense-level saving through `POST /api/v1/cards`, with source context,
  item type, selected sense, and the Understand/Produce/Disambiguate intents.
- The create-card response now returns the persisted card, so clients can confirm
  the server-created learning item rather than treating an empty 201 as success.
- Reader text selection now offers a “Look up” action that opens Discover with
  the selected text and containing sentence. Saving then happens without leaving
  Discover, and the item is immediately eligible for Review.
- Public and degraded states: lookup remains useful when either external lexical
  provider is unavailable, and signed-out visitors see the account boundary only
  at Keep.

## Missing dependencies / not implemented from the mockup

1. **Canonical structured lexical entries.** Current senses come from the configured
   translation provider per request. There is no versioned, corrected, cached entry
   entity shared by all visitors.
2. **Sense identity and deduplication.** `selectedSense` is durable text on a learning
   item, not a foreign key to a canonical sense. Keeping the same entry/sense twice is
   not prevented, and two senses cannot yet share a canonical entry record.
3. **Morphology and word-family graph.** Prefix/root/stem fields, living-family edges,
   compounds, ordering by frequency, and family-vs-confusion edge types do not exist.
4. **Frequency methodology.** The shipped evidence is a relative `ngrams.dev` score and
   corpus label. Per-million counts, ranks, print-vs-speech comparison, language-specific
   calibrated thresholds, lemma-vs-form provenance, and stored snapshots are absent.
5. **Contextual sense disambiguation.** Pasting a sentence stores context and lets the
   user choose a word, but it does not automatically select the correct sense. Doing so
   needs a deterministic disambiguator and canonical sense inventory.
6. **Encounter history.** Discover/Reader do not record lookup events, repeated unkept
   lookups, shelf occurrence counts, or the “looked up, not kept” list.
7. **Reader inline sheet.** Reader now hands selected text and context to Discover; it
   does not yet open the full sheet as an inline drawer over the paragraph. Mobile word
   selection depends on the browser/WebView selection gesture rather than tap-level token
   markup.
8. **Public indexable word URLs and SSR.** There is one client-rendered `/discover` route,
   not a server-rendered `/de/ausgabe` page with related-entry and book backlinks.
9. **Examples and multilingual meaning sets.** Provider translations are shown in one
   chosen fluent language. Curated examples, CEFR per sense, library citations, all user
   languages, cross-language notes, and fresh generated examples are absent.
10. **Audio.** Existing text-to-speech infrastructure is authenticated and uncached;
    normal/slow member playback and its entitlement/cost policy are not wired here.
11. **Correction and provenance workflow.** There is no correction queue, entry version,
    generation date, human-correction count, or public “suggest a correction” flow.
12. **Free-tier keep cap.** The mockup’s 100-word free limit and exact cap messaging are
    not enforced by the card service. This needs a backend entitlement invariant before
    the UI can present trustworthy counts.
13. **Personal confusion presentation.** Review persists confusion edges, but Discover
    does not expose them on the sheet or offer a specific opposing word when the learner
    chooses Disambiguate.
14. **Discover recommendations.** “From the chapter you are in,” above-level candidates,
    and saved/lookup history panels require token-level book indexing, learner-level
    estimates, and encounter storage.
15. **Final emblem motion.** The loading state respects reduced motion and the Keep label
    changes in place, but the exact multi-blade unfold/fold emblem animation needs a
    reusable emblem-motion component and approved vector asset behavior.
16. **External-provider caching and resilience.** Lookup degrades safely, but responses
    are not cached. Rate limits, provider latency, and provider availability remain runtime
    dependencies until canonical entries are persisted.
17. **Lexical autocomplete.** The old English-only Datamuse suggestions were removed
    because they could not supply the mockup's sense, translation, register, or target-language
    behavior. Ranked multilingual suggestions need the canonical entry index.
18. **Held-key diacritic popup.** The always-visible, keyboard-accessible character row is
    implemented. The former per-keystroke popup is not attached to the new textarea yet; it
    should return as a true press-and-hold interaction rather than opening after every ordinary
    letter.

## Reader answer before this iteration

No. Reader had no card/learning-item service call and no navigation or selection action
for vocabulary creation. Its content click handler only controlled parallel-text overlay
behavior. After this iteration, Reader can initiate the creation flow by selecting text,
choosing “Look up,” and keeping the resulting item in Discover.
