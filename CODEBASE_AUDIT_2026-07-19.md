# Almonium frontend codebase audit

**Audit date:** 2026-07-19  
**Repository:** `almonium-fe`  
**Scope:** Static review of the full frontend tree, dependency/configuration review, Git history sampling, production build, lint run, test run, and npm production-dependency audit. I did not inspect the backend/infra implementations, exercise authenticated flows against a live API, perform a visual browser/device QA pass, or conduct a professional penetration test.

## Executive summary

Almonium is a substantial but unfinished Angular language-learning application. The strongest implemented areas are authentication/onboarding, language/profile configuration, graded and parallel-text reading, social/chat integration, and subscription/profile UI. The landing page, authenticated home, all four games, About, Terms, and Privacy are currently explicit “not ready” placeholders.

The code is **salvageable and worth continuing**. A technology rewrite is not justified by what is in this repository. The application builds successfully with strict Angular/TypeScript settings and already contains meaningful domain behavior that would be expensive and risky to recreate. The better course is a stabilization phase followed by incremental modularization.

My overall assessment is **medium-low production engineering quality (roughly 5/10), with a sound enough foundation**:

- Product/domain implementation: **6.5/10** — a meaningful amount of real functionality and thoughtful UX behavior exists.
- Architecture/maintainability: **5/10** — recognizable Angular structure, but several very large components and inconsistent patterns.
- Tests/release confidence: **1/10** — zero tests and no quality gates beyond building the Docker image.
- Security/dependency hygiene: **3/10** — known vulnerable locked dependencies and a serious unsafe-HTML trust boundary.
- Performance: **4/10** — the build works, but initial loading is much larger than it should be.
- Accessibility: **3/10** — the configured accessibility lint rules expose many concrete issues, but lint is not passing.

The immediate problems are not “Angular problems.” They are missing tests, ignored lint debt, vulnerable dependencies, unsafe HTML handling, large eager bundles, incomplete public/legal pages, and oversized components.

## What I understand the project to be

Almonium appears to be a language-learning platform with these product pillars:

1. **Language learner profiles and onboarding**
   - Firebase email/password, Google, and Apple identity flows.
   - Backend cookie session exchange after Firebase sign-in.
   - Email verification, password reset, account linking, and recent-auth flows.
   - Fluent and target language setup, CEFR self-assessment, interests, username/profile/avatar setup.
   - Free/premium plans, limits on target languages, payment/portal flows.

2. **Reading**
   - A bookshelf filtered by target language, CEFR range, title, rating/year/level, and translation availability.
   - Book metadata, favorites, translation ordering, and reading progress.
   - A sophisticated reader with saved scroll progress, chapters, keyboard/touch behavior, and parallel text in inline, overlay, and side-by-side modes.
   - This is the most complex and distinctive frontend feature.

3. **Vocabulary discovery and review**
   - Word/text frequency lookup.
   - Language-aware autocomplete and diacritic input.
   - Vocabulary card data with translations, examples, tags, iteration, priority, and active-learning fields.
   - The review screen currently fetches cards, but the repository does not yet show a complete spaced-repetition workflow.

4. **Social learning**
   - Public user profiles and relationship/friend/block states.
   - Stream Chat channels, messages, unread state, custom actions, avatars, presence, and translations.
   - Firebase Cloud Messaging/browser notifications.

5. **Planned engagement features**
   - Ladder, crossword, higher/lower, and duel concepts are advertised, but every game route is currently a placeholder.
   - Landing and home are also placeholders, which makes the current product feel more like a feature-rich private beta than a complete public release.

## What is already written

Approximate frontend size:

| Area | Observed size/state |
|---|---:|
| TypeScript files | 149 |
| TypeScript application lines | 15,855 |
| HTML template lines | 4,046 |
| Less component/style lines | 4,763 |
| Frontend source/assets | 5.7 MB |
| Test/spec files | 0 |
| Routes | Public, unauthenticated, authenticated, settings lazy module, static/payment/game routes |
| Taiga UI usage | Imports in 46 TypeScript files |
| Direct `.subscribe()` calls | About 330 |
| `any` occurrences in TS | About 75 |
| Console calls | About 215 |

The frontend is mostly standalone Angular components, with a small remainder of NgModules around settings and shared icons. It uses feature-oriented folders (`authentication`, `onboarding`, `sections/read`, `sections/social`, `settings`, `shared`, `services`) rather than one flat component collection.

Key technical choices:

- Angular 20, TypeScript 5.9, RxJS 7.8, strict TypeScript and strict Angular templates.
- Taiga UI 4 for forms, overlays, controls, layout, validation, and interaction primitives.
- Less plus Tailwind 3, with additional global Stream Chat, Font Awesome, Flaticon, Lucide, and OverlayScrollbars styling/assets.
- Firebase Auth, Storage, and Cloud Messaging.
- Stream Chat Angular/JS SDKs.
- Cookie-authenticated backend API with a custom XSRF interceptor.
- Angular service worker/PWA manifest and push-notification worker.
- Docker multi-stage build served by nginx; GitHub Actions build ARM64 images and trigger infra deployment.

## What is good

- **The production build succeeds.** Angular AOT, optimization, output hashing, service worker generation, and strict compilation all complete.
- **The framework baseline is modern.** This is not an abandoned Angular 12-era repository. Recent commits upgraded deployment and migrated authentication to Firebase.
- **Strictness is enabled.** `strict`, `noImplicitReturns`, strict DI, and strict templates are valuable guardrails even though lint debt remains.
- **Feature boundaries are understandable.** A new engineer can locate reader, chat, onboarding, settings, and shared UI without reverse-engineering an exotic architecture.
- **There are real domain models.** User setup steps, plans/limits, learner profiles, CEFR levels, books, translations, cards, and relationships are represented explicitly.
- **Authentication has several sound ideas.** Firebase persistence is in memory, Firebase ID tokens are exchanged for a backend cookie session, mutating API requests get XSRF handling, and user-related local state is cleared on logout.
- **Some RxJS lifecycle handling is responsible.** Several larger components use `takeUntil` and cleanup subjects, and some components manually dispose third-party subscriptions/listeners.
- **The reader contains valuable product-specific work.** Parallel formatting, progress persistence, layout modes, and scroll behavior are not commodity scaffolding.
- **PWA groundwork exists.** Manifest, Angular service worker, responsive styles, Firebase push, and installable icons are already present.
- **Deployment is automated.** Production and staging Docker deployment workflows exist, with immutable commit image tags and GitHub Actions cache usage.

## Immediate glaring problems

### P0: Unsafe HTML trust boundary in the reader

`ReaderComponent` and `ParallelFormatPipe` call `DomSanitizer.bypassSecurityTrustHtml` on book/parallel HTML received from the backend. The pipe also copies and constructs `innerHTML`. A comment says the Gutenberg source is assumed safe; that assumption is not an enforceable security boundary.

If an imported book, translation pipeline, administrator account, upstream source, or backend response is compromised, this can become stored XSS. The application also caches a `UserInfo` object containing `streamChatToken` in `localStorage`, increasing the impact of any XSS.

Recommended action:

- Sanitize imported content on the backend at ingestion with a narrow element/attribute/protocol allowlist.
- Sanitize again before browser rendering with the current DOMPurify release and an equally narrow configuration.
- Only bypass Angular sanitization **after** explicit sanitization, or preferably render a parsed structured document model without raw HTML trust.
- Remove `streamChatToken` and unnecessary PII from persistent browser storage; fetch short-lived chat credentials when needed.
- Add malicious-fixture tests covering scripts, SVG/MathML, event attributes, dangerous URLs, styles, and malformed markup.

Related `[innerHTML]` uses in info/action-modal components should be reviewed according to whether input can ever be server- or user-controlled.

### P0: Locked production dependencies have known vulnerabilities

`npm audit --omit=dev` reported **32 advisories: 2 critical, 19 high, and 11 moderate**. Direct affected packages include the locked Angular 20.2.2 set, DOMPurify/Taiga DOMPurify, `glob`, `uuid`, and `stream-chat-angular`; critical findings appear transitively in `protobufjs` and `websocket-driver`.

Not every npm advisory is exploitable in a browser build, and some server-oriented transitive packages may only be tooling paths. Nevertheless, the Angular XSS/XSRF/service-worker advisories and DOMPurify findings directly overlap this application's behavior. The current `package-lock.json` is what `npm ci` deploys, so permissive `^` ranges in `package.json` do not protect the deployed build.

First update Angular 20 to the latest 20.3 patch, update dependencies available within current majors, rerun the audit, inspect dependency paths for remaining findings, then plan Taiga UI 5 and other major upgrades. Do not run a blind forced audit fix without tests.

### P0/P1: Public/legal surface is visibly incomplete

Landing, home, About, Terms of Use, Privacy Policy, and all four games render `app-not-ready`. The application loads Google Analytics immediately from `index.html`, while the privacy and terms pages are placeholders. Before a public/commercial launch, complete the legal pages and review analytics/notification consent behavior for target jurisdictions.

The public `/test` route should also be removed or development-gated.

### P1: There is no test safety net

No `*.spec.ts` files exist. The configured Karma run executes **0 of 0** specs and exits non-zero in this environment. There are no end-to-end or component tests visible either.

This is the largest obstacle to confident maintenance. High-value first coverage should be:

1. Firebase identity-to-backend-session authentication and logout.
2. Auth/unauth/onboarding guards.
3. HTML sanitization and parallel-format transformations.
4. Reader progress save/restore and book/language switching.
5. Onboarding step transitions and plan limits.
6. API service error contracts.
7. One Playwright smoke path for public boot, login, onboarding, bookshelf, reader, settings, and chat shell.

### P1: Lint is configured but effectively not adopted

`npx ng lint` reports **1,142 problems (1,141 errors, 1 warning)**. About 213 are automatically fixable. Findings include unsafe `any` operations, floating promises, accessibility failures, unhandled typing boundaries, unused values, invalid selectors, and style-modernization rules.

Some noise comes from enabling aggressive stylistic/current-Angular rules such as `prefer-inject` on an older code style. Do not treat all 1,142 as equally risky. Establish a pragmatic baseline:

- Keep correctness, unsafe typing, promise, and template accessibility rules as errors.
- Temporarily downgrade broad migration/style rules if necessary.
- Fix existing findings by category.
- Add `npm run lint` and enforce no new findings in CI.

### P1: Bundle size and eager loading

The successful production build produced:

| Bundle | Raw | Estimated transfer |
|---|---:|---:|
| Initial JavaScript + CSS | 4.99 MB | 746.81 kB |
| Global styles alone | 1.95 MB | 135.78 kB |
| Lazy settings chunk | 93.10 kB | 19.28 kB |

Almost every route component is eagerly imported in `app.routes.ts`; only settings is lazy. Global CSS combines Taiga UI, Tailwind base/components/utilities, complete Font Awesome CSS, all Flaticon icons, Stream Chat styles, and OverlayScrollbars. Build budgets are set to 10 MB warning/20 MB error, which is too permissive to catch regressions.

Recommended action:

- Lazy-load each route/feature with `loadComponent`/`loadChildren`, especially reader, social/Stream, onboarding, and games.
- Audit icon packages and remove duplicate/full-font sets where Lucide or selected SVG icons suffice.
- Audit global versus route-specific Stream and component styles.
- Set progressively tighter, realistic budgets after the first reduction.
- Measure with a bundle analyzer and real mobile Web Vitals before guessing further.

### P1: Stale client auth cache is treated as route truth

`UserInfoService.loadUserInfo()` returns cached `localStorage` data without validating the backend session. The app initializer does call the backend, but on a 401/error it returns `null` without clearing previously cached user information. `unauthGuard` trusts that cache directly.

This is not a backend authorization bypass if the API correctly enforces its cookie session, but it can route a logged-out user into protected UI, preserve stale PII/chat credentials, and produce confusing auth loops. Server session state should determine authentication; local data should be a rendering cache only and should be cleared on an authoritative 401.

### P1: CI deploys without tests, lint, or audit gates

GitHub Actions builds and pushes Docker images but does not separately run lint, tests, dependency review, or browser smoke checks. Add a pull-request/branch quality workflow and make deployment depend on it. Add automated dependency update tooling and secret scanning.

### P1/P2: Container SPA routing is not evident

The Docker image copies the browser build into stock `nginx:alpine` without an nginx configuration containing `try_files ... /index.html`. Unless the infra layer injects a configuration, direct navigation/refresh on routes such as `/reader/123` will return nginx 404. Verify the deployed configuration in `almonium-infra`; add an explicit frontend nginx config if it is not supplied there. Also pin the nginx base to a controlled version/digest.

## Maintainability and code smells

### Oversized components

Several components combine orchestration, API calls, DOM manipulation, formatting, state machines, and presentation:

- `reader.component.ts`: 1,296 lines
- `social.component.ts`: 1,180 lines
- `auth-settings.component.ts`: 678 lines
- `language-setup.component.ts`: 631 lines
- `discover.component.ts`: 566 lines
- `navbar.component.ts`: 547 lines
- `user-preview-card.component.ts`: 441 lines
- `auth.component.ts`: 412 lines

The reader in particular should be decomposed into a document parser/formatter, progress repository, scroll controller, parallel-layout controller/directive, reader facade/state, and smaller view components. Extract behavior behind tests before changing it.

### Subscription and async consistency

There are roughly 330 direct subscriptions but only about 60 `takeUntil` uses. Some subscriptions are finite HTTP calls or root-lifetime subscriptions and are harmless; others in `DiscoverComponent`, language setup, book/read components, and settings appear long-lived or listener-based without consistent teardown. Nested subscriptions also make cancellation and error behavior hard to reason about.

Use `takeUntilDestroyed`, `async` pipe/signals for view state, and higher-order RxJS operators. In autocomplete, use `switchMap` so a slow old response cannot overwrite a newer query. Store and remove every renderer/DOM listener.

### Error handling sometimes hides failure

Several services convert errors to `[]`, `null`, or `EMPTY` after logging. That prevents callers from distinguishing “there is no data” from “the network/server failed.” For example, deleting/saving reader progress can appear complete when the request failed.

Adopt typed error/result behavior and display retryable states. Centralize HTTP error mapping rather than repeatedly reaching into untyped `error.error.message`.

### Type boundaries are weaker than strict settings imply

`UserInfo.fromJSON`, learner parsing, local-storage methods, HTTP error objects, Stream callbacks, and several service responses use `any`. Runtime JSON is accepted as the model without schema validation, so strict TypeScript cannot protect these boundaries.

Use DTO interfaces plus runtime validation for important auth/profile/book/chat payloads (for example, generated OpenAPI clients or a schema library). Avoid class hydration unless class behavior materially helps.

### Direct DOM and platform coupling

The reader and discover experiences manipulate DOM ranges, `innerHTML`, scroll measurements, `window`, `document`, and timers directly. Some of that is justified by the rich reader/editor interaction, but it makes testing, SSR, and mobile portability harder. Encapsulate it in directives/controllers with narrow interfaces.

### Mixed and redundant UI/style dependencies

The app uses Taiga UI, Tailwind, Less, an SCSS Stream bundle, Font Awesome CSS and icon package, Flaticon, Lucide, and bespoke CSS. This increases global CSS, visual inconsistency, and upgrade surface. Define which system owns controls, spacing, typography, and icons; remove redundant packages.

Other hygiene issues:

- A directory is literally named `src/app/sections/social/ chat-header` with a leading space.
- `settings-routing.model.ts` is a routing module, not a model.
- `ParallelFormatPipe` is repeated four times in one component import list.
- There are many production `console.log` calls.
- Commented-out code and “keep as is/adjust selector” migration comments remain in complex paths.
- `glob`, `rimraf`, and the package named `install` appear under production dependencies even though they are build/tooling or apparently unused.
- `@angular/platform-browser-dynamic`, `@angular/animations`, some icon packages, and other dependencies appear unused and should be verified/removed.
- API endpoint constants are mutable static fields rather than readonly configuration/tokens.
- Whole-route navigation visibility is calculated from string prefixes and a one-time `window.innerWidth`, rather than route data plus reactive viewport state.

## Functional/product completeness risks

- Landing and home have no product content.
- All game implementations are placeholders despite cards/routes advertising them.
- Terms, privacy, and About are placeholders.
- Review displays fetched cards but does not yet expose a full learning loop here.
- Whole-app internationalization is not implemented; `ngx-translate` appears mainly configured for Stream Chat while most application strings are hardcoded English.
- Offline PWA behavior only caches the application shell/assets; there is no explicit offline content/data strategy for books, cards, or pending progress.
- Firebase messaging service worker is pinned to the old `9.22.0` compat scripts while the installed Firebase package is 11.x. Align this deliberately and test browser support/update behavior.

## Is it outdated?

**Partly, but not fundamentally.**

- Angular 20 is still in LTS through 2026-11-28 according to Angular's [official support schedule](https://v21.angular.dev/reference/releases). It is a valid production framework choice. The repository is one registry major behind Angular 21, but a major upgrade is less urgent than installing the latest secure Angular 20.3 patches.
- The lockfile's Angular 20.2.2 packages are materially behind the available 20.3 patch line and are affected by published advisories. This is urgent.
- Taiga UI 4.51 is behind both the later v4 patch line and Taiga UI 5. Taiga provides an official [v4-to-v5 migration guide](https://taiga-ui.dev/migration-guide/), and this project meets its Angular 19+ prerequisite. Upgrade to latest v4 first, then migrate under tests.
- Stream Chat, Firebase, Tailwind, Maskito, ngx-translate, tsParticles, and multiple tooling packages have newer major/minor versions. Update based on compatibility and actual value, not just version numbers.
- Karma/Jasmine is usable, but for a greenfield test layer I would favor fast Angular unit/component tests plus Playwright browser tests rather than investing heavily in Karma-specific infrastructure.
- The application's coding patterns are older than its package versions: constructor injection, heavy subscriptions, manual teardown, NgModules in one feature, mutable component state, and direct DOM manipulation. These patterns still work; modernize opportunistically rather than rewriting everything to signals at once.

## Is Taiga UI justified?

**Yes for this web application, with caveats. Keep it for now.**

Taiga UI is a comprehensive Angular-native component kit with forms, overlays, validation, navigation, layout, accessibility foundations, and active migration tooling. The official project is active and currently documents Taiga UI 5 via its [getting-started guide](https://taiga-ui.dev/getting-started/). Almonium uses it across 46 TypeScript files, particularly in difficult form/onboarding/settings flows. Replacing it would consume substantial time without improving the product domain.

The choice is less compelling where Almonium already builds bespoke components or pulls in several competing icon/style systems. The current use of `@taiga-ui/legacy` is migration debt, the installed version is behind, and Taiga should not be assumed to provide a native-mobile interaction model.

Recommendation:

- Keep Taiga UI as the web design-system foundation.
- Upgrade v4 fully, remove `legacy` usages, then migrate to v5.
- Create thin Almonium wrapper components/tokens for the small set of common controls and branding, without wrapping every Taiga primitive.
- Consolidate icon and styling systems.
- Do not make mobile screens reuse Taiga components merely to claim code reuse.

Angular Material would have a broader default ecosystem but switching now would be a costly horizontal rewrite. A headless/custom design system would demand more accessibility and interaction engineering than this project currently has capacity to absorb.

## Is a rewrite in another web technology warranted?

**No.** React, Vue, Svelte, or another SPA framework would not automatically solve any top finding in this audit. The unsafe HTML, missing tests, stale dependencies, auth-cache semantics, bundle composition, accessibility gaps, and incomplete product pages would all have to be addressed in the new implementation too.

A rewrite would also discard or re-debug the most valuable work: reader mechanics, parallel text, onboarding state, chat customization, auth/account linking, language selectors, profile/plan rules, and API integration.

Reconsider a rewrite only if a strategic constraint appears that is not visible here—for example, no ability to hire/retain Angular skills, a company-wide platform mandate with funded migration, or measured mobile/native requirements that a web runtime cannot meet. Otherwise use a strangler-style refactor inside Angular.

## Confidence working with Angular

Yes. I am confident working deeply with modern Angular: standalone components, dependency injection, router/lazy loading and guards, typed reactive forms, RxJS/signals interoperability, HTTP/interceptors, security/sanitization, service workers, SSR/hydration tradeoffs, testing, performance profiling, and Angular library migrations. Taiga UI is also workable because it exposes normal Angular APIs and maintains migration documentation.

The risk here is not framework unfamiliarity. It is changing complex untested behavior. The responsible way to work is to add characterization tests around auth, reader, onboarding, and chat seams before major refactoring.

## Mobile stack recommendation

### Recommended default: Ionic Angular + Capacitor, as a mobile-focused app sharing non-UI code

For this team/codebase, start with **Ionic Angular and Capacitor**. Ionic provides Angular-specific, touch-oriented mobile components, while Capacitor packages web technology for iOS and Android and exposes native APIs. See the official [Ionic Angular overview](https://ionicframework.com/angular) and [Capacitor documentation](https://capacitorjs.com/docs).

I would structure a monorepo approximately as:

```text
apps/
  web/       Angular + Taiga UI
  mobile/    Ionic Angular + Capacitor
libs/
  api/       generated API client and DTOs
  domain/    CEFR, plans, learner/book/card rules
  auth/      session interfaces and platform adapters
  utilities/ pure language/text helpers
```

Share domain models, validation, API clients, pure text transformation, analytics contracts, and perhaps state facades. Build mobile navigation and views with Ionic components. Keep Taiga UI in the web app.

There are two sensible phases:

1. **Cheap validation:** add Capacitor to a branch and wrap the current responsive Angular build to test login, reader, chat, push, keyboard behavior, safe areas, back navigation, and store constraints on real phones. Capacitor can be added to an existing web app.
2. **Production mobile UX:** create a dedicated Ionic Angular app/shell and migrate features in product-priority order while sharing non-visual libraries.

Important integration work:

- Replace browser popup-centric OAuth with mobile-appropriate Firebase/native authentication flows.
- Implement push through Capacitor/native Firebase plugins and keep browser FCM as a web adapter.
- Test Stream Chat's web SDK inside the hybrid runtime under realistic long conversations; its UI may need a mobile-specific composition.
- Design offline book download, card review queues, progress synchronization, and conflict handling explicitly.
- Treat reader performance, selection, font controls, screen wake behavior, safe areas, and accessibility as first-class device QA.

### When to choose something else

- Choose **Flutter** or fully native Swift/Kotlin if the mobile app becomes the primary product and measured requirements demand highly native UI, extensive offline/background work, or performance the hybrid reader/chat cannot meet. Expect to share API contracts and product rules, not Angular code.
- Choose **React Native** only if the team deliberately wants to become a React/React Native team. It has no special reuse advantage with this Angular repository.
- Do not choose a mobile stack before a short Capacitor proof-of-concept on representative low/mid-range devices. The current app is already responsive in places and has PWA/push groundwork, so evidence is inexpensive.

## Recommended plan

### First 1–2 weeks: stop avoidable risk

1. Patch Angular 20 to latest 20.3 and update safe current-major dependencies; rerun build/audit.
2. Fix the reader HTML pipeline and remove chat credentials/PII from persistent local storage.
3. Complete or hide privacy, terms, landing, home, games, About, and `/test` according to launch scope.
4. Make server session state authoritative and clear stale cache on 401/logout.
5. Verify nginx SPA fallback in infra.
6. Add CI jobs for build, a pragmatic lint baseline, zero-test detection, and dependency review.

### Weeks 2–4: create confidence

1. Add unit tests around auth/session, guards, models, sanitization/parallel formatting, and API services.
2. Add Playwright smoke tests for critical user journeys.
3. Triage lint by risk category; fix accessibility and unsafe async/type findings first.
4. Remove unused dependencies and production console noise.
5. Add error-state/retry behavior where services currently turn failures into empty data.

### Months 2–3: improve architecture and speed

1. Lazy-load major routes and move heavy third-party styles to the features that need them.
2. Split reader and social components behind tested facades/controllers.
3. Generate/validate API DTOs and centralize typed HTTP errors.
4. Consolidate UI/icon/style ownership.
5. Upgrade Taiga UI latest v4 to v5 and remove legacy APIs.
6. Define whole-app i18n and offline-data strategies.
7. Run a Capacitor/Ionic mobile proof-of-concept.

## Verification results

Commands were read-only with respect to application source until this report was added.

| Check | Result |
|---|---|
| `npm run build` | Passed; warnings for one 12.07 kB component style and CommonJS dependencies |
| Initial production bundle | 4.99 MB raw / 746.81 kB estimated transfer |
| `npx ng lint` | Failed: 1,142 findings |
| `npm test -- --watch=false --browsers=ChromeHeadless` | Built and ran 0 specs; non-zero exit |
| Test-file search | 0 `*.spec.ts` files |
| `npm audit --omit=dev` | Failed: 32 advisories (2 critical, 19 high, 11 moderate) |
| Git worktree before report | Clean |

## Bottom line

Continue with Angular. Keep Taiga UI for the web application. Do not rewrite the frontend. Stabilize security/dependencies and build a test harness before broad refactors. For mobile, validate the existing experience in Capacitor, then favor a dedicated Ionic Angular mobile UI that shares domain/API code with the Taiga-based web app. Reserve Flutter/native for a later evidence-based decision if hybrid performance or native-product expectations genuinely require it.
