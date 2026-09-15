# Review implementation

The `/review` surface implements the backend contract and visual states from
`Almonium Review.dc.html`: due overview, a typed prompt with disclosed hint
costs, confusion-specific feedback, leech recovery, and the session record.

Architectural decisions and backend invariants are recorded in
`../../almonium-be/docs/REVIEW_ARCHITECTURE_DECISIONS.md`. In particular, the
browser renders server-owned state; it does not schedule items, infer outcomes,
or persist review intervals locally. API payloads are runtime-validated before
they enter component state.

The completion surface says “short re-encounter” and renders saved examples.
It must only use the “Dessert” / “written this minute” claim after the backend
adds a metered, quality-controlled generation adapter.
