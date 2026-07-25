# Repository agent guidance

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
