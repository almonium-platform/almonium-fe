# Almonium

Almonium is a language-learning web app. What is synced here is its **token and
type layer**, not a component library: the product palette, the semantic
surface/ink tokens, and the three self-hosted typefaces. Build UI with plain
elements styled from these tokens.

There is **no component bundle and no provider to wrap in** — nothing to import,
nothing to mount. The app itself is Angular and its components do not ship here.

## Styling idiom: CSS custom properties

Every design decision is a `var(--token)`. Tailwind is present in the source app
but its config is stock (`theme: {extend: {}}`), so it contributes no branded
utility names — do not reach for `bg-brand-*` or `text-surface-*`, they do not
exist. Reference the tokens directly.

```css
background: var(--card-color);
color: var(--reader-text-color);
border: 1px solid var(--hairline-color);
border-radius: var(--card-radius);
box-shadow: var(--box-shadow);
```

### The vocabulary

| Group | Tokens |
|---|---|
| Brand ramp (light→dark) | `--brand-raspberry` `--brand-premium` `--brand-flat-logo` `--brand-margin` `--brand-primary` `--brand-hover` `--brand-pressed` `--brand-ink` |
| Ground & surface | `--page-ground` `--card-color` `--nested-color` `--overlay-color` |
| Ink | `--reader-text-color` `--subhead-color` `--metadata-color` `--text-color` `--on-brand-color` |
| Lines & controls | `--hairline-color` `--control-border-color` `--secondary-control-border-color` `--secondary-control-fill` |
| State | `--state-hover` `--state-pressed` `--state-selected` |
| Status | `--success-color` `--success-bg-color` `--danger-text-color` `--danger-bg-color` `--warning-color` `--waiting-color` |
| Disabled | `--disabled-fill-color` `--disabled-label-color` |
| Depth | `--box-shadow` `--overlay-shadow` `--shadow-color` `--scrim` |
| Gradients | `--premium-gradient` `--avatar-gradient` |
| Type | `--font-family-ui` `--font-family-reading` `--font-family-mono` |
| Geometry | `--card-radius` `--header-height` |

Chat and avatar surfaces have their own families (`--chat-*`, `--avatar-*`) —
read `tokens/tokens.css` before styling either; the comments there explain why
they do not simply follow the card/nested pair.

## Light and dark

Bare `:root` is light. The dark set is bound to `html[data-theme='dark']`, and
to `html[data-theme='system']` under a dark OS preference — the same contract
the app uses. Set the attribute on `<html>`; never hard-code a hex that a token
already covers, or dark mode silently breaks.

`--premium-gradient` is built from brand tokens, so it re-derives per theme on
its own. Leave it alone.

## Type

`--font-family-ui` (IBM Plex Sans) is body and UI. `--font-family-reading`
(Literata, a serif) is headings and long-form reading. `--font-family-mono` is
IBM Plex Mono. Weights available: Literata 400/400-italic/500/600/700, Plex Sans
400/500/600, Plex Mono 400. Asking for a weight outside that list gets a
synthesised face.

## Where the truth lives

`styles.css` is the entry point and `@import`s everything. Read
`tokens/tokens.css` for the full annotated token set — its comments carry the
reasoning behind the chat, avatar, and channel families — and `fonts/fonts.css`
for the exact faces.

## An idiomatic build

```html
<article style="
  background: var(--card-color);
  border-radius: var(--card-radius);
  box-shadow: var(--box-shadow);
  padding: 1.25rem;">
  <h2 style="font-family: var(--font-family-reading); color: var(--brand-ink); margin: 0 0 .25rem;">
    Daily review
  </h2>
  <p style="color: var(--subhead-color); margin: 0 0 1rem;">Twelve cards are due.</p>
  <button style="
    background: var(--brand-primary);
    color: var(--on-brand-color);
    border: 0; border-radius: 999px; padding: .6rem 1.25rem;
    font-family: var(--font-family-ui);">
    Start
  </button>
</article>
```
