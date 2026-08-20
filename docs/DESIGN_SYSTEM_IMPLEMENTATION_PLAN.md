# Design-system implementation plan

Source documents: `Almonium Constitution.html` and `Almonium
Action Items.html`. This plan turns their
rules into sequenced, repository-scoped work; it does not replace them.

## Decision: token layer

`src/styles/variables.less` is the authoritative token layer. It is already
loaded globally, supports runtime CSS custom properties (needed by existing
components), and can feed both application CSS and Taiga UI overrides.

Tailwind is not an owner: its config currently contains no product palette or
typography and should only map utility names to these semantic values later.
Taiga UI is also a consumer: keep `--tui-*` bindings in the global token file
and local component overrides only when a component needs a scoped variant.

Use semantic tokens in new code (`--brand-primary`, `--reader-text-color`,
`--page-ground`) rather than adding new literal colours. Compatibility aliases
remain only while old components are migrated.

## Logo asset rule

`logo-flat.svg` is the single-colour `#7D2060` fallback. Use it for the
browser favicon, QR/monochrome marks, print, embroidery, and any plum or
single-ink ground. Do not use it for the animated navbar/loading emblem, the
full-colour product mark, or the wordmark lockup.

SVG is the correct browser/print asset and needs no PNG derivative. Keep the
existing PWA raster icons at 72, 192, and 512 pixels. Email is the exception:
email clients generally do not render SVG. The email header should use a 2x
PNG raster of `title-purple.svg`: 336 × 90 pixels displayed at 168 × 45 with
`alt="Almonium"`. An email that needs only the emblem may use a 2x PNG at the
actual displayed dimensions; it is not a substitute for the header wordmark.

## Current triage

| Status | Item | Evidence / disposition |
| --- | --- | --- |
| Done in this iteration | Token ownership and first semantic/ramp tokens | `src/styles/variables.less` is now the source of truth. |
| Done in this iteration | Approved fonts self-hosted | Literata + IBM Plex Sans/Mono are bundled through `@fontsource`; Libre Baskerville was removed. |
| Done in this iteration | Flat-mark usage | Browser favicon and QR mask use `logo-flat.svg`. |
| Already present | Login lockup tightening | The uncommitted auth Less change reduces the emblem to 2.5rem and adds a gap. |
| Already present | Generic CTA no longer lifts on hover | The uncommitted CTA Less change removes `translateY(-1px)`; reintroduce only for explicitly primary controls in the button-state pass. |
| Already done in backend worktree | Email shell/body/footer/premium gradient baseline | Existing uncommitted backend templates use the documented shell, body colour/leading, footer contrast, and premium gradient. Do not overwrite them from this repo. |
| Not frontend work | Email PNG deployment and email HTML compatibility | Implement in `almonium-be` after confirming how `logoUrl` is hosted; needs a separate backend commit. |
| Not implementation work | Wordmark licence purchase/receipt | Owner/legal decision; block only distribution where required. |
| Out of scope unless commissioned | Almo and animal illustration production, mug/print artwork | Requires approved source artwork and design/production ownership. |
| Superseded document | `Almonium Design System Extraction.dc.html` | Its prior cyan/system-font/gradient guidance is superseded by the Constitution; preserve deletion already in the worktree. |

## Remaining sequence

1. **Foundation migration (P0/P1):** replace remaining hard-coded body black,
   cyan, legacy violet, and component font declarations with semantic tokens;
   map Taiga variables consistently; remove unused gradient helpers and
   non-premium gradient text. Verify major screens visually.
2. **Controls and accessibility (P0/P1):** create reusable primary,
   secondary, tertiary, premium, incomplete, disabled, and destructive button
   states. Add focus treatment, 44px touch targets, labelled icon controls,
   labelled visibility switch, and typed-confirmation account deletion.
3. **Reader and surfaces (P1):** apply reader typography/colour/17–19px,
   card radius/shadow tokens, remove inner shadows, and gate particles on
   `prefers-reduced-motion`. Audit Discover, Review, and Chat before applying
   their rules because they were not analysed in the source material.
4. **Brand motion and auth (P1):** correct fold/unfold semantics and loader
   timing, preserve navbar navigation while playing unfold, cross-fade the
   login greeting, and add reduced-motion alternatives.
5. **Product flows (P0/P1):** remove the onboarding paywall; then rework
   onboarding order/state persistence and contextual paywalls. This may touch
   backend and mobile contracts, so inspect both before changing shared flow
   logic.
6. **Settings/profile/premium (P1/P2):** merge profile/username surfaces,
   rework plan presentation, add the guarded premium effects, and restore
   only effects proven absent after a repository search.
7. **Backend email pass (P0/P1):** commit the already-correct template work
   separately, provide the 336×90 wordmark PNG through the configured public
   asset path, then complete table/inline/VML/plain-text and mail-client tests.
8. **Deferred P2:** reader font preference, placement test, language rail,
   blade gauges, spine shelf, marginalia, weekly target, certificates, and
   commissioned illustrations.

Each implementation slice must include a visual regression check for its
affected route(s), an accessibility check where it changes interaction or
motion, and a focused commit in the owning repository.
