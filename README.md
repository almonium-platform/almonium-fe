# Almonium Frontend

Angular browser client for Almonium. The coordinated workspace also contains:

- `../almonium-be`: Spring Boot API and browser authentication/session backend;
- `../almonium-mobile`: Expo/React Native iOS and Android client using the same
  API with Firebase ID-token bearer authentication;
- `../almonium-infra`: deployment topology and Ansible/Compose automation for
  the server-hosted FE and BE services. Mobile releases use Expo/EAS rather
  than this server deployment path.

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
