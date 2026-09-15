# Almonium Frontend

Angular browser client for Almonium. The coordinated workspace also contains:

- `../almonium-be`: Spring Boot API and browser authentication/session backend;
- `../almonium-mobile`: Expo/React Native iOS and Android client using the same
  API with Firebase ID-token bearer authentication;
- `../almonium-infra`: deployment topology and Ansible/Compose automation for
  the server-hosted FE and BE services. Mobile releases use Expo/EAS rather
  than this server deployment path.

## Interface languages

The interface is written in English and marked for translation with Angular's
own i18n: `i18n` on any element that holds copy, `i18n-placeholder` and friends
on attributes, `$localize` around strings built in TypeScript. Ids are hashes of
the text, so a line that is reworded simply loses its old translations; nothing
is named by hand. A lint rule (`@angular-eslint/template/i18n`) fails the build
on unmarked copy, so the extraction below is complete by construction. The ops
console and the scratch route are excluded from the rule and never translated.

Translations load at runtime, before the app is imported (`src/main.ts`), so
there is one build for every language. The setting under **Settings → App →
App language** follows the browser until a language is picked, and a change
reloads the page. The choice is stored per device beside appearance.

```
npm run i18n
```

That extracts every marked message to `src/locale/messages.json` (the file to
hand to a translator) and stretches it into `src/assets/i18n/pseudo.json`, the
pseudo-locale: `[Šéţţîñĝš~~~~]`. Accents mark text that went through
translation, the tail is the surplus a longer language such as German brings,
and a missing bracket is a clipped end. A dev build offers it in the language
select; one pass through the app in it stands in for testing every language.
Text that appears unaccented in it is copy that never went through i18n. Rerun
the command after changing copy.

Adding a language: translate `messages.json` into `src/assets/i18n/<code>.json`
(same shape, `locale` set to the code), add one line to `UI_LOCALES` in
`src/app/services/ui-locale.ts`, and register its Angular locale data in
`applyUiLocale` for dates and numbers. Layouts already give text room: no
fixed widths on containers that hold copy, ellipsis only on user-generated
strings such as names and titles.

## Greyed-controls harness

Every control that greys out on a condition rather than on a request in flight
carries one line saying what the reader still has to do. Those screens sit
behind a signed-in account and live backend state, which makes them awkward to
check by hand, so the harness gathers them onto one page with a toggle for each
blocking condition:

```
npm run harness
```

That writes `tools/disabled-states-harness.html` — open it from disk. Its CSS
is compiled from the real component `.less` files, so rerun it after a style
change; the markup and copy are mirrors, and each card names the template and
line it mirrors. Taiga textfields and switches, Font Awesome glyphs and the
shipping fonts are stand-ins, so read spacing as indicative and wording as
exact. The command also writes a gitignored `.artifact.html` twin, which is the
same page without the document wrapper, for publishing.
