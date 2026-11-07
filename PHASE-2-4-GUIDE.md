# Phase 2-4 Implementation Guide

How to take this repository from its current baseline to the v0.1 release. Phase 1 is complete: its output is in [docs/security/](docs/security/), and threat IDs (T1-T15) and requirement IDs (G1-G27) below refer to those documents.

## Ground rules

- **This repository is public.** Every commit is visible, and deleting one later doesn't undo that.
- **Real values never enter git.** Gateway URLs, merchant IDs, team IDs and API keys stay in git-ignored `.env.local` and `Secrets.xcconfig` files. Tests use `example.com` hosts and clearly fake keys.
- **One branch and pull request per step.** For example, `fix/2.0-quick-fixes`. Merge to `main` only when that step's "Done when" list passes.
- **Every step updates the threat model.** Change the threat's status in [THREAT-MODEL.md](docs/security/THREAT-MODEL.md) in the same pull request.
- **Contract changes go in both languages.** Update TypeScript and Swift together.

Before every push:

```bash
pnpm build
```

```bash
pnpm turbo run typecheck test
```

```bash
gitleaks git . --config .gitleaks.toml --redact
```

From `packages/pay-ios`:

```bash
swift test
```

## Before you start

| Task | Why |
|---|---|
| Confirm in writing that you own this code or may publish it | The repository is already public, so settle this first. Make it private if the answer isn't clear yet |
| Rotate the sandbox API key | It was exposed in a working session, although not in git |
| Copy local config into this folder: `.env.local`, `Secrets.xcconfig`, `.certs/` | Git-ignored files aren't part of the repository |

## Phase 2: Main fixes

Work through the steps in order. Step 2.0 doesn't depend on the new payment model, so it comes first.

### Step 2.0: Quick fixes

Threats: T4, T5, T9, T10, T12, plus bugs found during review.

| Fix | Where |
|---|---|
| Show sheet success only for `AUTHORIZED` and `CAPTURED` (T4) | `packages/pay-web/src/GatewayPay.ts`, `ApplePayCoordinator.swift` |
| Remove the `sessionToken` console log (T5) | `GatewayPay.ts` |
| Make failure logging debug-only, with no body or sensitive headers (T9) | `HTTPClient.swift` |
| Make token parsing throw on bad data, and accept raw `Data` so it can be tested (T10) | `ApplePayToken.swift` |
| Reject a second `authorize()` while one is active (T12) | `GatewayPay.ts`, `ApplePayCoordinator.swift` |
| Move the status mapping into a pure function so it can be tested | Both SDKs |
| Add `requiredBillingContactFields` and `requiredShippingContactFields` to the schema, because `validate()` strips them today | `packages/core/src/validation/schemas.ts` |
| Bind `fetch` to `globalThis`; an unbound call normally throws in browsers | `packages/core/src/http/client.ts` |
| Map `jcb` to `JCB` and remove the `jsc` typo | `packages/pay-web/src/applepay/request.ts` |
| Remove the example's diagnostic `fetch` wrapper after the binding fix | `apps/example-web/src/main.ts` |

**Decision needed:** how `PENDING` appears to the customer. The threat model suggests failing the sheet and returning a distinct SDK result.

**Done when:** each fix has a test, and T4, T5, T9, T10 and T12 are marked `Mitigated`.

### Step 2.1: Secure authentication and the mock gateway

Threats: T1, T2, T3. Requirements: G1-G5, G19, G21, G26.

1. Create `apps/mock-gateway`, a Hono service that tests can call in-process with `app.request()`. It reuses the zod schemas from `@gateway/pay-core`.
2. Add its safety limits first, following [ADR 0003](docs/security/adr/0003-mock-gateway-scope.md): it refuses to start with `NODE_ENV=production`, makes no calls to Apple, stores data in memory only, and accepts only fake tokens that carry a mock marker.
3. Implement the routes:

| Route | Caller | Purpose |
|---|---|---|
| `POST /v1/payment-intents` | Merchant server, with secret key | Fixes amount, currency, reference and origin; returns `clientSecret` |
| `POST /v1/session` | SDK | Exchanges `clientSecret` for a session |
| `POST /v1/validate-merchant` | Web SDK | Checks the Apple host and domain, then returns a stub |
| `POST /v1/payments` | SDK | Runs all intent, replay and idempotency checks |
| `GET /v1/payments/:id` | Merchant server | Returns the real status |
| Signed webhook | Mock to merchant | Confirms the result, using HMAC-SHA-256 |

4. Replace `apiKey` with `clientSecret` in all three SDKs and remove `amount` from what clients send. The amount shown in the sheet comes from the gateway.
5. Add a small merchant server demo that creates intents and receives webhooks.
6. Update the example apps and [Merchant-Doc.md](Merchant-Doc.md).

**Done when:** no SDK accepts an API key, the examples run against the mock, and tampered-amount, reused-secret, expired-secret and wrong-origin tests pass.

### Step 2.2: Request validation

Threats: T11, T13. Requirements: G7, G8.

- Add zod response schemas in core, and matching decoding checks in Swift.
- Reject expired sessions and environment mismatches.
- Add size limits for `metadata`, and check that line items add up to the total.
- Add Swift request validation.
- Replace the fixed `/ 100` with a currency exponent table.
- Create shared JSON fixtures that both test suites read.

**Done when:** malformed responses fail closed, and TypeScript and Swift pass the same fixtures.

### Step 2.3: Token handling

Threats: T5, T9, T10. Requirement: G14.

- Hold tokens and secrets in memory only.
- Enforce `expiresAt` before using a session.
- Add one redaction helper for TypeScript and one for Swift.
- Ban `console.log` in SDK source with a lint rule.

**Done when:** tests capture log output and confirm that no token or secret appears.

### Step 2.4: Replay protection

Threat: T8. Requirements: G15-G18.

- Bind each idempotency key to a payload hash in the mock.
- Return `409` for the same key with a different payload.
- Return the original result for the same key and payload.
- Make intents and session tokens single-use.
- Reject a repeated Apple `transactionId`.
- After a timeout, have the SDK check `GET /v1/payments/:id` before reporting a result.
- Add a test-only fault switch that saves a payment, then drops the connection.

**Done when:** replay tests pass, and a timeout resolves to the real payment status.

### Step 2.5: TLS and transport

Threats: T6, T7. Requirements: G9, G10, G22, G24.

- Reject non-HTTPS `baseUrl` values, except loopback addresses during development.
- Reject non-Apple `validationURL` hosts in the SDK, and allowlist them in the mock.
- Take the validation domain from the merchant's registered list, not client input.
- Add TLS 1.2+ and HSTS settings to the mock when TLS is on.
- Add CSP guidance to the merchant guide.

Certificate pinning stays out of v0.1, as [ADR 0002](docs/security/adr/0002-no-certificate-pinning.md) explains.

**Done when:** T6 and T7 tests pass on TypeScript and Swift.

## Phase 3: Tests and CI

### Step 3.1: Fix lint

Add an ESLint flat config to `packages/core` that uses `tooling/eslint/index.js`, and add `eslint`, `@eslint/js` and `typescript-eslint` as dependencies. Add `lint` scripts to the other packages.

### Step 3.2: Complete the security tests

Every threat needs a passing test or a documented reason it can't have one.

| Layer | Proves | Tools |
|---|---|---|
| Attack requests to the mock | The server rejects tampering and replay | Vitest, `app.request()` |
| SDK with fake responses | The SDK fails safely | Vitest, Jest, fake `fetch` and `ApplePaySession`; XCTest with `URLProtocol` |
| SDK against the running mock | The parts work together over HTTP | Vitest, or Playwright with a stubbed `ApplePaySession` |
| Repo and pipeline | No leaks or known-vulnerable dependencies | gitleaks, `pnpm audit`, CodeQL |

Add `fast-check` property tests for amount conversion and validation.

### Step 3.3: Add CI

Pin every action to a commit SHA and set minimal `permissions`.

| Workflow | Runs |
|---|---|
| `ci.yml` | Lint, typecheck, test and build on Ubuntu |
| `ios.yml` | `swift test` and an iOS build on macOS |
| `secret-scan.yml` | gitleaks (already exists) |
| `identifier-check.yml` | Checks for banned identifiers, reading the list from a CI secret |
| `codeql.yml` | JavaScript/TypeScript and Swift |
| `dependency-review.yml` | Blocks pull requests that add vulnerable dependencies |

Also add `.github/dependabot.yml` for npm and GitHub Actions.

**Never commit the identifier list.** It would publish the names it's meant to keep out.

### Step 3.4: Triage dependencies

1. Run `pnpm audit --prod` and `pnpm audit`.
2. Separate what ships in packages from example and development tooling.
3. Upgrade what you can, and record any justified exceptions in `docs/security/`.
4. Align the `typescript` version across packages, because `pay-web` is on 6.x.
5. Add a CI gate for high and critical advisories in production dependencies.

**Phase 3 is done when:** all workflows pass on `main`, and every threat links to a test or a documented residual risk.

## Phase 4: Finish and release v0.1

The clean snapshot is already done, so this phase needs no history rewrite. It only needs a final check.

### Step 4.1: Tidy the code

- Set one version number everywhere. Packages say `1.0.0`, and the iOS `X-Sdk-Version` header says `2.0.0`.
- Remove unused code: `Retry.swift` unless Step 2.4 uses it, and `MerchantValidator.swift`.
- Remove the unused `NativeModule` import in `packages/pay-react-native/src/index.ts`.
- Update the outdated `apps/example-ios/README.md` and `apps/example-rn/README.md`.

### Step 4.2: Write the public docs

| File | Contents |
|---|---|
| `README.md` | What this is, a quick start with the mock gateway, the architecture diagram, usage examples for each platform, and a clear note that it is a reference and not certified for production |
| `SECURITY.md` | How to report a vulnerability, supported versions, and links to the security docs |
| `CHANGELOG.md` | The v0.1.0 entry |
| `Developer-Doc.md`, `Merchant-Doc.md` | Updated for the payment intent model |
| `docs/security/*` | Final threat statuses and residual risks |

Delete this guide or move it to `docs/` when the work is complete.

### Step 4.3: Configure GitHub

- Protect `main`: require pull requests and passing checks.
- Turn on secret scanning with push protection.
- Turn on private vulnerability reporting.
- Turn on Dependabot alerts.

### Step 4.4: Release check

Run this on a fresh clone:

- [ ] Written permission to publish is confirmed
- [ ] `pnpm install --frozen-lockfile`, `pnpm build`, typecheck, tests, `swift test` and the iOS build all pass
- [ ] `gitleaks git .` is clean across the full history
- [ ] The identifier check is clean across all commits and files
- [ ] The README quick start works from nothing
- [ ] A real payment passes on a device or verified domain, using a gateway that can process sandbox tokens
- [ ] Every threat is `Mitigated` or `Accepted`, with the reason recorded

### Step 4.5: Publish

Tag `v0.1.0` and create a GitHub Release with the changelog entry. Publishing to npm or CocoaPods is out of scope for v0.1.

## What the mock can't prove

Passing tests against the mock shows how the SDK behaves. It doesn't show that any real gateway is secure. The real Apple Pay sheet, merchant validation and token decryption all need Apple's systems: use an iPhone with a sandbox tester account, and Safari on a verified domain. Any real gateway must meet [GATEWAY-REQUIREMENTS.md](docs/security/GATEWAY-REQUIREMENTS.md).
