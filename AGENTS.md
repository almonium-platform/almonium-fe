# Repository agent guidance

## Product stage: pre-launch

Almonium has no live users. The owner drops and reseeds state whenever it is
convenient - the backend database, the Stream application, Firebase, all of it -
so nothing already stored is worth preserving for its own sake.

- Do not write code whose only purpose is to carry existing state across a
  change: backfills, migrations of cached or persisted client state, branches
  that read an old shape. Change the shape and start clean.
- Prefer the simpler change even when it invalidates what is stored. Say plainly
  in the handoff that it does, and let the owner reseed.
- Revisit this section the moment the product has real users.

## Almonium ecosystem

This Angular client is part of a coordinated workspace with neighboring
repositories:

- `../almonium-be` owns the Spring Boot API, Firebase-session exchange,
  HttpOnly cookie security, Liquibase migrations, and backend CI/CD. For API
  DTO, route, error-contract, authentication, cookie/CSRF/CORS, or user-flow
  changes, inspect and update the backend as needed; commit each repository's
  changes separately. Read `../almonium-be/AGENTS.md` first, and consult its
  authentication and local-development documents before changing auth flows.
- `../almonium-infra` owns deployed topology, Ansible, Compose templates,
  Traefik, shared PostgreSQL/RabbitMQ, and encrypted runtime configuration.
  It is the source of truth for deployment configuration and secrets. Read its
  `AGENTS.md` before changing it; never copy vault material or production
  credentials into this repository.
- `../almonium-mobile` is the Expo SDK 54 React Native client for iOS and
  Android. It shares the backend API and product flows, but uses Firebase
  bearer tokens and native/Expo distribution rather than the browser's
  HttpOnly-cookie session or this repository's container deployment. Coordinate
  API DTO, authentication, and user-flow changes across both clients.

- Keep `src/environments/environment*.ts` aligned with the API environment
  being targeted. A frontend environment/configuration change may require the
  matching backend binding and infra deployment configuration.
- The frontend staging workflow builds an ARM64 image and invokes the infra
  repository's frontend Ansible playbook. SSH access does not authorize
  bypassing this deployment path or making ad-hoc production changes.
- For an end-to-end feature, validate the browser behavior against the matching
  backend environment, including cookies and CSRF behavior where applicable.

- Finish every implementation iteration with a Git commit after the requested work has been verified.
- Before committing, review the diff, preserve unrelated user changes, and run the checks appropriate to the change.
- If a requested iteration cannot be completed or verified, explain the blocker instead of creating a misleading success commit.
- Keep dependency upgrades reproducible by committing both `package.json` and `package-lock.json`.
