# Threat Model

Threat model for Gateway Pay SDK, read alongside [ARCHITECTURE.md](ARCHITECTURE.md), which defines the components, boundaries (B1-B6) and invariants used here.

- **Method:** STRIDE applied to each trust boundary. Risk is likelihood × impact.
- **Status values:** `Open` (not addressed), `Partial`, `Mitigated`, `Accepted`. All tests named here are planned unless marked otherwise.
- **Review:** update this document whenever an endpoint, credential or data flow changes.

## Assets

| ID | Asset | Why it matters |
|---|---|---|
| A1 | Order integrity (amount, currency, reference) | Tampering means goods for less than the agreed price |
| A2 | Merchant secret key and webhook secret | Allow acting as the merchant or forging payment confirmations |
| A3 | `clientSecret`, API key and session token | Allow starting or completing payments |
| A4 | Apple Pay token | An encrypted payment credential that must only be used once |
| A5 | Merchant identity and verified domains | Allow Apple Pay to run under a merchant's name |
| A6 | Customer contact data | Personal data |
| A7 | Payment status accuracy | Customers and merchants act on it |
| A8 | Source, dependencies and release artifacts | Compromise reaches every integrating merchant |

## Actors

| ID | Actor | Capability |
|---|---|---|
| AC1 | Malicious customer | Full control of their own browser, app and network traffic |
| AC2 | Script in the merchant page | Reads the page and SDK state, can call the SDK |
| AC3 | Network attacker | Can observe or intercept traffic where TLS is missing or misconfigured |
| AC4 | Another merchant | Holds valid credentials for a different merchant |
| AC5 | Malicious dependency or maintainer | Runs code at build time or in the page |
| AC6 | Insider or compromised CI | Can reach secrets or alter a release |

## Attack surface

| Surface | Boundary | Exposure |
|---|---|---|
| `POST /v1/session` | B2 | Public; takes a client credential |
| `POST /v1/validate-merchant` | B2, B4 | Public; takes a URL and domain, and the gateway then makes an outbound call |
| `POST /v1/payments` | B2 | Public; takes the token and session |
| `POST /v1/payment-intents` (target) | B3 | Server-to-server; takes the secret key |
| `GET /v1/payments/:id` (target) | B3 | Server-to-server; used by merchants to confirm status |
| Webhooks (target) | B3 | Inbound to the merchant server |
| SDK options (`baseUrl`, `domainName`) | B2 | Set by integrators, and reachable by any page script |
| `loadApplePaySDK()` | B5 | Loads a remote script |
| Logs: browser console and iOS unified log | B1 | Readable on the device |
| CI, dependencies, repository contents | B6 | Everything shipped or published |

## STRIDE summary

| Boundary | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| B1 Device ↔ page or app | T7 | T4 | | T5, T9 | | |
| B2 Page or app ↔ gateway | T2, T6 | T1, T11, T13 | T3 | T5, T6 | T12 | T1 |
| B3 Merchant server ↔ gateway | T3 | T3 | T3, T8 | | | |
| B4 Gateway ↔ Apple | T7 | | | | | T7 |
| B5 Third-party scripts | T14 | T14 | | T2, T5 | | |
| B6 CI and release | T14 | T14 | | T15 | | |

## Threats

Severity is the rating before mitigation. A threat with no "Residual risk" line is expected to have none once mitigated, beyond the general [residual risks](#residual-risks).

| ID | Threat | Actors | Assets | L | I | Severity | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| T1 | Amount or order tampering | AC1, AC2 | A1 | High | High | Critical | Mock, SDK | Open |
| T2 | API key extracted from a client | AC1, AC2 | A3 | High | High | Critical | Mock, SDK | Open |
| T3 | Fulfilment based on a client-reported result | AC1 | A1, A7 | High | High | High | Merchant, Mock | Open |
| T4 | Sheet shows success for an unsuccessful payment | None (logic flaw) | A7 | Medium | High | High | SDK | Open |
| T5 | Session token exposed through logs | AC2 | A3 | High | Medium | High | SDK | Open |
| T6 | Credentials sent to the wrong host or over plain HTTP | AC2, AC3 | A3, A4 | Medium | High | High | SDK | Open |
| T7 | SSRF or domain spoofing through merchant validation | AC1, AC4 | A5 | Medium | High | High | Mock, SDK | Open |
| T8 | Token or session replay, and ambiguous results after a timeout | AC1, AC3 | A1, A4, A7 | Medium | High | High | Mock, SDK | Partial |
| T9 | Failure details in iOS release logs | AC1 | A3, A6 | Medium | Medium | Medium | SDK | Open |
| T10 | Malformed iOS token sent with silent defaults | None (logic flaw) | A4, A7 | Low | Medium | Medium | SDK | Open |
| T11 | Gateway responses trusted without validation | AC3 | A7 | Low | High | Medium | SDK | Open |
| T12 | Concurrent `authorize()` calls overwrite state | AC2 | A7 | Medium | Medium | Medium | SDK | Open |
| T13 | Weak or inconsistent validation across platforms | AC1 | A1, A7 | Medium | Medium | Medium | SDK, Mock | Open |
| T14 | Dependency or script compromise | AC5 | A3, A8 | Medium | High | Medium | Repo | Open |
| T15 | Confidential data exposed in the repository | AC6 | A2, A8 | Medium | High | High | Repo | Open |

### T1: Amount or order tampering

- **Attack:** a customer changes `total.amount` in the request before it reaches the gateway, or a page script does so. The body of `/v1/payments` includes the client-supplied `request`, and nothing ties it to a server-side order.
- **Mitigation:** the merchant server creates an intent, and the gateway uses the intent's amount and ignores any amount from the client (ADR 0001). The amount shown in the sheet comes from the gateway.
- **Test:** `tampered amount is rejected or ignored`.
- **Residual risk:** a merchant that creates intents from unverified client input still has this problem.

### T2: API key extracted from a client

- **Attack:** the key is read from the JS bundle, the app's `Info.plist`, or React Native source, then used to open sessions and generate traffic under the merchant's name.
- **Mitigation:** remove API keys from all clients and use a `clientSecret` that is short-lived, single-use, and bound to an intent and origin.
- **Test:** `SDK has no apiKey option`; `reused clientSecret rejected`; `expired clientSecret rejected`; `wrong origin rejected`.
- **Residual risk:** a `clientSecret` stolen during its short life can still be used for that one intent, but only at its fixed amount.

### T3: Fulfilment based on a client-reported result

- **Attack:** a customer forges a success result to the merchant's front end, which then releases the order.
- **Mitigation:** signed webhooks with a timestamp, plus `GET /v1/payments/:id`. Merchant docs state that fulfilment must use these.
- **Test:** `forged webhook signature rejected`; `stale webhook timestamp rejected`.
- **Residual risk:** the SDK can't force a merchant to verify. This remains a documented integration requirement.

### T4: Sheet shows success for an unsuccessful payment

- **Flaw:** an HTTP 200 with `status: "DECLINED"`, `"FAILED"` or `"PENDING"` still completes the Apple Pay sheet as a success on web (`GatewayPay.ts`) and iOS (`ApplePayCoordinator.swift`).
- **Mitigation:** map payment status to the sheet result. Only `AUTHORIZED` and `CAPTURED` report success. The `PENDING` behaviour needs a decision: report it as failure in the sheet and surface it distinctly through the SDK result.
- **Test:** `declined, failed and pending never show sheet success`, for TS and Swift.

### T5: Session token exposed through logs

- **Attack:** `GatewayPay.ts` prints the full session response, including `sessionToken`, with `console.log` in every build. Page scripts and error-tracking tools can capture console output.
- **Mitigation:** remove the logging and add a lint rule that bans `console.log` in SDK source.
- **Test:** `no log output contains tokens or secrets`.

### T6: Credentials sent to the wrong host or over plain HTTP

- **Attack:** `baseUrl` and `baseURL` accept any URL, so a misconfiguration or page script can send credentials and tokens elsewhere, or over HTTP.
- **Mitigation:** require HTTPS and allow plain HTTP only for loopback addresses. iOS keeps App Transport Security with no exceptions.
- **Test:** `http base URL rejected`; `loopback base URL allowed`, for TS and Swift.
- **Residual risk:** a script running in the merchant's page can still call the SDK or read its memory (see T14).

### T7: SSRF or domain spoofing through merchant validation

- **Attack:** `validationURL` and `domainName` come from the client. An unchecked gateway could be made to call an internal host while presenting its merchant certificate, or to request a session for a domain that isn't the merchant's.
- **Mitigation:** the gateway allowlists Apple's validation hosts and takes the domain from the merchant's registered list or the intent's origin. The SDK also rejects non-Apple hosts, as defence in depth.
- **Test:** `non-Apple validationURL rejected`; `unregistered domain rejected`.

### T8: Token or session replay, and ambiguous results after a timeout

- **Attack:** a captured request or token is submitted again, or a client retries after a timeout when the first attempt actually succeeded.
- **Done so far:** the web SDK sends one idempotency key across retries of a request, covered by tests in `client.test.ts`.
- **Mitigation:** bind each idempotency key to a payload hash, make intents and session tokens single-use, deduplicate on Apple's `transactionId`, and add a status lookup so a timeout can resolve to a real result.
- **Test:** `replayed token rejected`; `same key with different payload returns 409`; `same key and payload returns original result`; `timeout resolves through status lookup`.
- **Residual risk:** deduplication depends on the gateway's storage being durable.

### T9: Failure details in iOS release logs

- **Issue:** `HTTPClient.logFailure` writes headers and up to 1,000 bytes of the response body to the unified log with `privacy: .public`, in all build types. The Authorization header is redacted, but the other content isn't.
- **Mitigation:** log only in debug builds, and exclude bodies and sensitive headers. Release builds log status, path and request ID.
- **Test:** `release logging excludes body and sensitive headers`.

### T10: Malformed iOS token sent with silent defaults

- **Issue:** `ApplePayToken(payment:)` uses empty strings and `.ec` when parsing fails, so an invalid token is still sent.
- **Mitigation:** make the initializer throwing, and fail the payment locally.
- **Test:** `malformed paymentData throws`; `empty paymentData throws`. The simulator produces empty tokens, so the demo flow needs a clear error for this.

### T11: Gateway responses trusted without validation

- **Issue:** TypeScript responses are cast with `as T`, and `environment` and `expiresAt` are ignored. A mismatched or malformed response could produce the wrong result.
- **Mitigation:** add zod response schemas in core and Decodable checks in Swift. Reject an expired session or environment mismatch. Treat a parse failure as a failure.
- **Test:** `malformed response fails closed`; `environment mismatch rejected`; `expired session rejected`.

### T12: Concurrent `authorize()` calls overwrite state

- **Issue:** the iOS coordinator holds one pending request and completion. A second call replaces them, so the first caller may never get a result. The web SDK has no in-flight guard.
- **Mitigation:** reject a second call while a flow is active, on all platforms.
- **Test:** `second authorize during active flow is rejected`.

### T13: Weak or inconsistent validation across platforms

- **Issue:** the Swift SDK has no equivalent to core's request validation. `metadata` has no size limit, line items aren't checked against the total, the web SDK divides every amount by 100 regardless of currency, and the network map has a `jsc` typo for `jcb`.
- **Mitigation:** tighten the schemas, add Swift validation, add a currency exponent table, and share JSON contract fixtures between both test suites. The gateway validates again.
- **Test:** `TS and Swift pass the shared contract fixtures`; property-based tests for amount conversion.

### T14: Dependency or script compromise

- **Issue:** `pnpm audit` reported 41 advisories for production dependencies and 106 in total at the time of writing. These haven't been triaged, and some may only affect example or dev tooling. `loadApplePaySDK()` loads Apple's script from its CDN with no integrity hash.
- **Mitigation:** triage advisories, then add Dependabot, dependency review, a `pnpm audit` gate, CodeQL, and actions pinned to commit SHAs. Merchant docs include CSP guidance.
- **Test:** CI fails on production high or critical advisories, and on actions not pinned to a commit SHA.
- **Residual risk (Accepted):** the script from Apple can't be pinned with SRI because Apple may update it at the same URL. A compromised dependency or injected script in a merchant's page can reach anything the SDK holds there.

### T15: Confidential data exposed in the repository

- **Issue:** the source and history contain environment-specific identifiers and internal diagnostics, as well as committed `node_modules`. Scans found no private keys or live key patterns.
- **Mitigation:** publish a cleaned snapshot as a new repository with a fresh root commit. Scan it with gitleaks plus a private denylist before release.
- **Test:** the scans must pass on a fresh clone of the release snapshot.

## Controls already in place

| Control | Evidence |
|---|---|
| No App Transport Security exceptions on iOS | `Info.plist` review |
| Example dev proxy verifies TLS | `apps/example-web/vite.config.ts` |
| One idempotency key across web retries | `packages/core/src/http/client.ts` and its tests |
| Retries limited to network errors and timeouts | `packages/core/src/http/client.ts` |
| Authorization header redacted in iOS logs | `Logger.redact` |
| Card data handled only by Apple Pay and the gateway | The SDKs only forward the encrypted token |

## Residual risks

| Risk | Why it remains | Treatment |
|---|---|---|
| Compromised merchant page | Any script on the page runs with the SDK's access | Accepted; CSP guidance and short-lived credentials limit the damage |
| Compromised customer device | Outside this project's control | Accepted; Apple Pay protects card data separately |
| Apple's hosted script | Required for the official button, and can't be pinned | Accepted; merchants may use CSS styling instead |
| A merchant skips server verification | The SDK can't enforce it | Documented as a go-live requirement |
| A real gateway differs from the mock | The mock only shows the expected behaviour | Real gateways must meet [GATEWAY-REQUIREMENTS.md](GATEWAY-REQUIREMENTS.md) |
| No real Apple Pay decryption in tests | The mock uses a fake token format | Manual testing on a device |
