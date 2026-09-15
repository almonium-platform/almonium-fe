# design-sync notes

## Scope: tokens and fonts only — no components

`almonium-fe` is an Angular **application** (`angular.json` → `projectType:
"application"`), not a component library. Claude Design renders React components
from a compiled bundle, so the 90 `.component.ts` files here cannot be synced by
any configuration. There is no Storybook and no `*.stories.*` file in the repo.

The sync therefore ships the token and type layer only. Designs made in Claude
Design will be on-brand in colour and type, but composed from generic components
rather than Almonium's own.

If component sync is ever wanted, it needs a React (or web-component) target —
not a config change here.

## Source of the tokens

- Light: the `:root` block in `src/styles/variables.less` (93 declarations).
- Dark: the `.dark-theme-tokens()` mixin in `src/styles.less` (64 declarations),
  bound to `html[data-theme='dark']` and to `html[data-theme='system']` under
  `prefers-color-scheme: dark`.
- Fonts: the nine `@fontsource` faces imported by `src/styles.scss`, self-hosted
  as latin-subset woff2.

Both counts reconcile exactly against the generated `tokens/tokens.css`
(92 + 1 dropped, 63 + 1 dropped).

## Findings

- **`--brand-flat-logo-image` is dropped from the sync** (both themes). Its value
  is `url('/assets/img/logo/logo-flat.svg')`, an app-served asset that cannot
  resolve outside the app; keeping it would ship a guaranteed 404. This is the
  only token excluded.
- **`--tui-background-accent-1-pressed` was defined only in the dark set — fixed.**
  Light mode was falling through to the Taiga UI default instead of a product
  value. `--tui-background-accent-1-pressed: var(--brand-pressed);` was added to
  the `:root` block in `src/styles/variables.less`, matching the dark set's own
  pattern and the existing `--brand-pressed` ramp step. This changes the pressed
  state of Taiga accent surfaces in light mode from Taiga's blue-ish default to
  the Almonium brand pressed purple. Light and dark now declare the same token
  names with no asymmetry.

## Regenerating

The bundle is generated, not hand-written. If the LESS token files change,
rebuild `ds-bundle/` and re-run the sync rather than editing the CSS.

`.design-sync/preview.html` is a local swatch harness (every token in both
themes, served over a static server). It is not uploaded — it exists to eyeball
the palette after a rebuild.
