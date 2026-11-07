# ADR 0003: Mock gateway scope

**Status:** Accepted

## Context

Most security controls are enforced on the server, but this repository has no server. Without one, the intent model can't be demonstrated, replay and authentication behaviour can't be tested, and a public user couldn't run the project.

## Decision

Add `apps/mock-gateway`, a small Node service used for tests and demos.

It will:
- Implement the intent, session, payment, status and webhook flows
- Enforce the controls marked in [GATEWAY-REQUIREMENTS.md](../GATEWAY-REQUIREMENTS.md)
- Reuse the zod schemas from `@gateway/pay-core`

It will never:
- Accept or decrypt real Apple Pay tokens. It uses a clearly fake token format.
- Contact Apple or any payment network
- Store data beyond memory
- Start when `NODE_ENV=production`

## Consequences

- Security tests can run in CI with no bank, Apple account or real credentials.
- Passing against the mock shows the SDK's behaviour, not that any real gateway is secure.
- The real Apple Pay sheet still needs manual testing on a device and a verified domain, using a gateway that can process sandbox tokens.
