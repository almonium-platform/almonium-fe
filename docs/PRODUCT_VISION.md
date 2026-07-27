# Almonium product vision

**Status:** Living founder document

**Last updated:** 2026-07-27

**Scope:** Product philosophy, target user, learning model, experience
principles, priorities, and business constraints. This is not a delivery
specification or a claim that every described capability already exists.

## Executive thesis

Almonium is a language-learning system for the full acquisition lifecycle of a
word, phrase, or reusable chunk of language.

It helps a learner:

1. encounter or search for an item;
2. understand its intended meaning in context;
3. decide whether it is useful enough to learn now;
4. save it with minimal friction and useful linguistic context;
5. retrieve it through varied, contextualized practice;
6. identify exactly how their knowledge is failing;
7. rehearse it in new contexts until it becomes usable language; and
8. encounter and reinforce it naturally through reading and other content.

The product is not defined by flashcards, a reader, a dictionary, AI-generated
stories, or games in isolation. Those are surfaces around one personal
linguistic knowledge and memory system.

The working proposition is:

> Almonium is an intelligent vocabulary-acquisition instrument for serious,
> self-directed language learners. It helps them choose the words and chunks
> that matter, understand them precisely, and move them from first encounter to
> productive use.

## Origin and founder perspective

Almonium comes from direct experience rather than an abstract edtech thesis.
Its founder reached C2 English through self-directed learning, now studies
German, knows four languages, and has repeatedly needed a collection of
disconnected tools for dictionaries, translation, frequency, pronunciation,
reading, cards, and contextual practice.

The original product center was **Discover**: a place with all the linguistic
context needed to investigate a word or phrase and create a useful learning
item from it. Reading, review, parallel books, sharing, and games later grew
around the same underlying problem.

Building the product has also been a technical and UX learning journey. That
exploration produced valuable capabilities, but it created scope drift. Future
work must preserve curiosity without allowing each interesting feature to
become an independent product.

## Initial user and market wedge

The first target user is not everyone who wants to learn a language.

The initial wedge is:

- an intermediate or advanced, self-directed learner;
- someone who consumes or wants to consume real content;
- someone who already collects vocabulary or combines multiple tools;
- someone who cares about collocations, precise usage, and productive
  vocabulary rather than completing a generic course; and
- often, but not necessarily, a multilingual learner.

Power users provide the best initial audience because they recognize the
fragmentation problem and value linguistic depth. The interface should remain
simple enough for a broader audience through strong defaults and progressive
disclosure. Almonium should not remove its most insightful capabilities in an
attempt to look generic.

## The core domain: learning items, not cards

A **card** is a presentation used during one exercise. It is not the complete
thing being learned.

The durable domain concept is a **learning item**. It may represent:

- a word in a selected sense and part of speech;
- a phrase or collocation;
- an idiom;
- a reusable chunk or construction;
- a multi-word expression;
- a phrase template with variable slots; or
- an item already understood receptively but not available productively.

For example, the noun and verb senses of `spend` should not be forced into one
undifferentiated card. A learner may know a common B1 sense of a spelling while
not knowing a rarer C1 or C2 sense. Natural language is inherently ambiguous;
the product should preserve and manage that uncertainty rather than pretending
every string has one deterministic definition.

A minimal conceptual learning item contains:

- language, written form, normalized form, and optional lemma;
- item type and part of speech;
- intended sense, with the source context that disambiguates it;
- one or more translations, definitions, or explanations;
- examples and collocations corresponding to the intended sense;
- pronunciation and form information where supported;
- source and encounter history;
- frequency evidence with corpus and calculation provenance;
- the learner's reason or intent for saving it;
- relationships to word-family members and confusing items; and
- memory and practice state.

Provider results and AI outputs are evidence, not unquestionable truth. The
learner must be able to correct the selected sense and important content.

## Knowledge is multidimensional

Almonium should not reduce knowledge to `known` or `unknown`.

A learner may:

- recognize an item but fail to produce it;
- understand one sense but not another;
- remember the translation but not the word's shape;
- recall the word only in the original memorized example;
- spell it incorrectly;
- pronounce it incorrectly;
- know its literal meaning but not its idiomatic use;
- know its meaning but combine it unnaturally;
- confuse it with another learned item; or
- understand every word in a chunk but never produce the chunk naturally.

The important dimensions include:

- meaning recognition;
- form recall;
- spelling;
- pronunciation;
- sense discrimination;
- grammatical behavior;
- collocational knowledge;
- recognition in a novel context;
- productive availability; and
- confusion relationships.

When saving an item, a learner may optionally express a learning intent:

- I do not understand this.
- I understand it but cannot produce it.
- I want to start using it.
- I confuse it with another item.
- I know the meaning but not the pronunciation or form.
- I know the words separately but not this chunk.

The chosen intent should affect the exercises and evidence required for
progress.

## The acquisition lifecycle

```text
Encounter
  → Investigate
  → Decide whether it matters now
  → Save with meaning and provenance
  → Retrieve in varied forms
  → Detect a specific weakness or confusion
  → Rehearse in new contexts
  → Produce independently
  → Reinforce through natural encounters
```

A useful secondary state model is:

```text
encountered → inspected → saved → learning → familiar → productive
                    ↓
              deferred / ignored
```

The system should record review events and evidence rather than prematurely
declaring that an item is permanently learned.

## Product surfaces

### Discover: investigate and acquire

Discover is the heart of the program. A learner can search, paste, or arrive
from another surface with a word, phrase, or context selection.

The default view should answer quickly:

- What does this mean here?
- How is it pronounced?
- Is it worth learning now?
- What is the most useful context to retain?
- Can I save it in one tap?

The default one-tap action creates a sensible learning item automatically.
Editing and specialist data remain available without making ordinary capture
feel like database entry.

An expanded view can include:

- other senses and parts of speech;
- translations into every fluent language;
- collocations and grammatical constructions;
- word-family and morphology information;
- common synonyms, antonyms, and contrasts;
- pronunciation variants;
- literal versus idiomatic meaning;
- frequency provenance;
- natural examples; and
- external investigation tools.

### Read: acquire from meaningful content

Reading is a primary encounter surface. A learner should be able to select a
word or phrase and open the same Discover experience without losing their
position.

The reader should eventually provide:

- contextual lookup and sense selection;
- pronunciation and audio;
- one-tap capture with the source sentence;
- previously learned and currently learning item indicators;
- accurate progress restoration;
- parallel editions and configurable parallel presentation; and
- useful pre-reading difficulty analysis.

The web and tablet experiences are particularly valuable for wide parallel
layouts. Mobile remains important for continuity and ordinary reading.

### Hunt: acquire in the open web

The Almonium browser extension should connect reading in the wild back to the
same learning system. On a target-language article or wiki page it can:

- open contextual Discover;
- save a word or phrase with its source;
- mark currently learning items;
- surface natural re-encounters;
- estimate document difficulty; and
- distinguish useful unknown items from items too rare for the learner's
  current goals.

Suggestions must remain advisory. A learner can save a rare specialist item
even when the system would defer it.

### Review: retrieve, diagnose, and repair

Review is not a single card-flipping mode. It should vary prompts while
preserving the underlying sense or chunk:

- target language to meaning;
- meaning to target language;
- cloze;
- typed production;
- audio to form or meaning;
- new contextual examples;
- collocation completion;
- sense discrimination;
- phrase reconstruction; and
- diminishing or progressive hints.

Review timing should use a proven synchronized scheduler rather than a
device-local bespoke interval table. Exercise results can update more specific
knowledge dimensions over time.

The scheduler should provide a sensible default session. Advanced learners may
also intentionally filter a session by retention stage—for example, fresh,
unstable, mature, repeatedly failed, or productive-practice items—without
having to micromanage every ordinary review.

### Stories and rehearsals: consolidate in context

Almonium can generate or curate medium-sized texts that deliberately include
weak, due, or selected items. The goal is not maximum keyword stuffing. The
text must remain coherent, level-appropriate, and natural.

A particularly strong session ending is:

1. perform scheduled retrieval;
2. identify failed or confused items;
3. generate a short coherent “dessert” containing a manageable subset;
4. read or listen to it;
5. complete one transfer activity such as cloze, dictation, reconstruction, or
   production.

Examples for one learning item should deliberately reuse other suitable active
items. This provides secondary reinforcement without introducing excessive new
vocabulary.

The longer-term “Hundred Stories” idea may become a curated collection of
high-density, level-aware texts containing important vocabulary, collocations,
idioms, and grammar. Personalized rehearsal texts should be validated before a
large static curriculum is produced.

### Share: exchange learning artifacts

The core social object is a learning item or pack, not a generic message.

A learner should eventually be able to share a card, phrase, or stack through a
link. A recipient can preview and import or fork selected items. This should
work before a recipient has an established Almonium social network, creating a
natural acquisition path.

Stream Chat attachments can later carry Almonium objects, but generic chat
expansion is subordinate to useful sharing.

### Play: alternate rehearsal

Games should consume the same learning items, confusion relationships, and
review evidence as the serious learning modes. They should not become isolated
content systems.

The frequency-based Higher or Lower concept is the clearest early game because
it expresses a distinctive Almonium concept and is understandable immediately.
Competitive “stronger card” or rare-word poker may remain a playful experiment;
rarity alone must not be presented as mastery or educational value. PvP work
depends on sufficient active-user density and comes later.

## Defining product intelligence

### Translation as a multilingual prism

For multilingual learners, one native or fluent language may capture a sense
more sharply than another. Almonium can show translations in multiple fluent
languages to triangulate meaning rather than treating one selected UI language
as the only bridge.

This is a precision tool, not a requirement to display every language at all
times. One primary translation remains visible by default; additional fluent
languages expand on demand.

### Frequency and learning priority

A logarithmic frequency score is valuable because raw corpus probabilities are
not human-readable. The existing 0–100 idea may remain as a product
representation, but it must not imply unsupported precision.

Frequency needs provenance:

- exact surface form versus lemma or word family;
- language and corpus;
- written versus spoken domain;
- calculation and data version; and
- limitations around senses and phrases.

Frequency is an input to a future learning-opportunity score, not the whole
decision. A recommendation can eventually combine:

```text
frequency
× relevance to the learner and current material
× probability the learner does not know it
× recurrence in encountered content
× collocational or productive value
× current memory state
```

Claims such as “12% above your level” should not ship until the underlying
level and frequency models are validated.

### Progressive hints, not binary answers

Sometimes a learner cannot recall even the shape of an item. Review can offer
diminishing cues rather than jumping directly from no information to the full
answer:

- item type or part of speech;
- approximate length;
- first letter or morphological ending;
- pronunciation;
- context or grammatical frame;
- related collocation; and
- finally the answer.

Hint usage is evidence of weaker recall and should not be scored as equivalent
to unaided retrieval. Hints must vary enough to avoid teaching the layout of a
specific card instead of the language.

### Confusion-aware feedback

If a learner answers item A with a meaning that belongs to item B, Almonium
should identify B:

> That answer means **B**. In this context, **A** means **X**.

The system can maintain explicit relationships such as:

- confused with;
- false friend of;
- sounds like;
- close in meaning but different in use;
- more idiomatic than; and
- commonly contrasted with.

Repeated confusion can schedule an A/B discrimination exercise. Deterministic
matching should detect the relationship first; AI may later generate a bounded
remediation exercise.

Homophones and sound-alike discovery are useful only when they solve an
observed learner confusion. They are not a product pillar by themselves.

### Novel context and transfer

Completing the same card repeatedly can measure memory of the card instead of
command of the item. Reviews should use new sentences and transfer checks.
Original context remains valuable as provenance and an initial memory anchor,
but it should not be the only evidence.

Different valid translations and paraphrases should be rotated. Multiple-choice
distractors should be plausible confusions, not unrelated words that make the
answer obvious.

### Difficult “leech” items

Learners should never need to press “remembered” merely to remove an item that
does not respond to the current method.

After repeated failure, Almonium can offer:

- suspend or defer;
- discard;
- change learning intent;
- simplify or split the item;
- add a better context, image, audio, or mnemonic;
- compare it with a confusing item;
- switch from isolated recall to a chunk;
- reduce its priority; or
- deliberately retain it as a specialist item.

Failure may mean the learning representation is wrong, not that the learner
needs more repetitions of the same card.

### Phrase templates and idiom slots

Some constructions contain variable people, objects, or actions. They should
not be stored as misleading artificial sentences or as opaque strings.

For example, a construction like `X has got nothing on Y` can be represented as
a phrase template with:

- a plain-language explanation;
- slot descriptions;
- several natural instantiations;
- common collocations; and
- reconstruction or slot-filling exercises.

Not every phrase needs formal templating. Normalize only structures where it
improves explanation or practice.

### Encounter history

A learning item should eventually tell its story:

- where and when it first appeared;
- every meaningful re-encounter;
- when it was saved;
- contexts in which it was used;
- repeated confusions;
- review and production evidence; and
- current learning intent.

This supports both better scheduling and a more human sense of progress than a
single iteration counter.

## Language support strategy

Almonium should allow basic manual learning in many languages without promising
the same enrichment quality everywhere.

Capability tiers:

- **Basic:** manual words, phrases, translations, notes, tags, and review.
- **Supported:** translation, TTS, tokenization, and frequency.
- **Enhanced:** morphology, collocations, sense-aware examples, pronunciation
  support, and better level analysis.
- **Almonium-grade:** evaluated end-to-end behavior, curated fallbacks, and
  high-confidence language-specific UX.

German and English are practical initial enhanced languages because they match
founder use and available resources. Language-specific behavior should live
behind capability adapters. Separate database tables per language are not
required; the difficult problems are morphology, senses, corpora, and
licensing, not PostgreSQL row capacity.

CEFR remains a useful self-reported and content-labeling framework, but
vocabulary size must not be presented as CEFR. A future optional calibration
can estimate receptive vocabulary separately and improve continuously from
real behavior.

## Books, editions, and parallel reading

Public-domain books provide a legal and operational starting point, not an
entire content strategy. Rights must be tracked per source, edition,
translation, and territory. A public-domain original does not make a modern
translation public domain.

The desired content pipeline is:

```text
ingest
→ rights and provenance
→ parse and sanitize
→ structural segmentation
→ difficulty analysis
→ optional adaptation or translation
→ alignment
→ automatic QA
→ human spot check
→ versioned publication
```

Parallel work should avoid a full pairwise Cartesian product. Each language
edition can align to canonical alignment groups. The client then composes any
two available editions. Pair-specific colored phrase alignment can be
generated and cached only for demanded pairs.

AI should resolve difficult alignment and adaptation cases, not replace cheaper
deterministic segmentation, multilingual embeddings, and alignment algorithms.
A small number of exceptional books is more valuable than a large unverified
catalogue.

Private user EPUB import is potentially valuable because it lets learners use
content they already care about. It requires secure parsing, sanitization,
strict isolation, cost controls, source retention rules, user rights
attestation, takedown processes, and legal review. User upload does not
automatically remove platform copyright responsibility.

## Design and UX philosophy

Almonium should feel like a warm, bookish, intelligent study companion rather
than an enterprise dashboard or a streak machine.

The established visual principles are:

- paper-warm cream ground and white raised surfaces;
- literary serif voice for brand and reading surfaces;
- quiet sans-serif controls and body copy;
- plum/aubergine identity with a restrained primary gradient;
- very round, friendly geometry;
- color used for meaning and state rather than decoration;
- personality through illustration and copy;
- local loading, error, and recovery states without losing context; and
- careful continuity across authentication, navigation, and interrupted work.

Product simplicity should come from progressive disclosure:

- one obvious default action;
- advanced linguistic detail behind expansion;
- one-tap creation for the common case;
- in-place editing for exceptions; and
- no requirement that ordinary users understand providers or data models.

Micro-interaction quality is valuable, but it cannot substitute for a coherent
activation and retention loop.

## Business position

Almonium should not claim that no product connects reading, lookup, contextual
cards, frequency, and spaced repetition. Existing products validate much of
the category.

The differentiation must come from the quality and integration of its learning
intelligence:

- multiple fluent languages as complementary meaning lenses;
- explicit senses, chunks, and learning intents;
- frequency informed but not frequency dominated prioritization;
- confusion-aware feedback;
- cross-item contextual reinforcement;
- varied evidence for receptive and productive knowledge;
- personal encounter history; and
- one knowledge state reused across Discover, reading, review, stories,
  sharing, and play.

The founder story is a credible marketing foundation:

> I reached C2 by combining a dozen disconnected tools. Almonium is the
> vocabulary-acquisition system I wished connected them.

The realistic initial ambition is a respected bootstrapped niche product. A
meaningful base of loyal paying learners is a success even without a
venture-scale outcome.

### Monetization principles

- Charge for durable learner value, not arbitrary inconvenience.
- Do not promise unlimited AI-heavy processing before cost is measured.
- A base subscription can cover synchronization, core intelligence, and
  ordinary fair-use enrichment.
- Expensive book processing or adaptation may use credits or one-time fees.
- Public-domain content can still support paid curation, processing, and UX.
- Premium limits must match capabilities actually implemented and enforced.
- Skins and premium avatars are optional expression, not the core reason to
  subscribe.

## Ruthless execution order

### Now: prove one complete acquisition loop

1. Define the minimal learning-item, encounter, confusion, and review-event
   model without building a giant linguistic ontology.
2. Move scheduling and memory state to the backend so web and mobile agree.
3. Deliver an excellent Discover vertical slice for German and English.
4. Retain basic manual cards for other languages.
5. Provide one-tap creation plus optional editing.
6. Review through varied prompts and novel contexts.
7. Detect at least one deterministic cross-item confusion.
8. End a session with a short context containing failed items.
9. Instrument the loop and recruit real learners.

### Next

- Reader selection opening the same Discover sheet
- Word and phrase encounter history
- A small high-quality parallel library
- Shareable and forkable learning-item packs
- Private EPUB import without heavy adaptation
- Honest landing, pricing, privacy, and terms
- Browser extension integration with the same item model

### Later

- More advanced placement and continuous level estimation
- AI-adapted public-domain editions
- Phrase-level colored parallel alignment for popular pairs
- Personalized high-density stories and writing prompts
- Heatmaps, meaningful streaks, and annual Wrapped
- Stream Chat learning-item attachments
- Higher or Lower and other solo review games

### Parking lot

- PvP infrastructure expansion
- Generic social-network growth
- Rare-word poker
- Graffiti handwriting space
- Broad homophone exploration without observed confusion
- Full enriched support for every language
- Large-scale book preprocessing without demand
- Infrastructure adopted mainly for résumé value

Curiosity remains part of the project. A deliberate split such as 80% core loop
and 20% product laboratory can preserve exploration without letting prototypes
control the roadmap.

## Validation and success criteria

Repository completeness does not validate the business. The next evidence must
come from behavior.

Early questions:

- Do learners repeatedly search or encounter items in Almonium?
- Do they accept the one-tap learning item or constantly repair it?
- Do they return for review without external prompting?
- Does confusion-aware feedback feel insightful?
- Do generated contexts improve later transfer?
- Which advanced fields do power users actually open?
- Does reading create learning items, or does lookup interrupt reading?
- Will users share packs with people outside Almonium?
- Which capability creates willingness to pay?

A useful first milestone is a small cohort of non-friend users completing the
acquisition-and-review loop several times per week over multiple weeks. Feature
count, registered users, and cards created are insufficient on their own.

## Technical and AI principles

- Deterministic detection and retrieval first; AI generation second.
- Structured, validated AI outputs with prompt/model/version provenance.
- Cache reusable provider and AI results.
- Preserve source and licensing metadata.
- Keep expensive work asynchronous, costed, and observable.
- Treat external APIs as replaceable providers, not domain truth.
- Use language capability adapters rather than conditionals spread throughout
  the product.
- Keep learning state synchronized and review history durable.
- Do not add search or messaging infrastructure until measured load requires
  it.
- Build the book processor into an idempotent, versioned pipeline only as
  content demand grows.
- Protect imported content and personal learning history as sensitive user
  data.

## Product constitution

Every proposed feature should answer at least one of these:

1. Does it help the learner encounter a valuable item?
2. Does it improve understanding of the intended meaning or use?
3. Does it reduce friction in capturing the item?
4. Does it produce better evidence of memory or productive command?
5. Does it diagnose and repair a specific weakness?
6. Does it create a meaningful natural re-encounter?
7. Does it improve acquisition, activation, retention, revenue, or a measured
   learning outcome?

If it does none of these, it is a laboratory idea or a side task, not a core
roadmap item.

The governing principle is:

> Almonium should know not merely whether a learner remembers an item, but how
> they know it, where that knowledge fails, and which next experience is most
> likely to turn it into usable language.
