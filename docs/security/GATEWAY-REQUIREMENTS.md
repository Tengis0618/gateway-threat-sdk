# Gateway Security Requirements

The SDKs are safe only if the gateway behind them enforces these controls. Any gateway used with this project, including the [mock gateway](adr/0003-mock-gateway-scope.md), should be measured against this list. The mock demonstrates the behaviour marked **Mock**; it isn't a production implementation.

The key words MUST and SHOULD carry their usual meaning. Threat IDs refer to [THREAT-MODEL.md](THREAT-MODEL.md).

## Authentication and intents

| ID | Requirement | Threats | Mock |
|---|---|---|---|
| G1 | MUST create payment intents only from authenticated server-to-server calls using a merchant secret key | T1, T2 | Yes |
| G2 | MUST fix amount, currency, reference and allowed origin when the intent is created, and ignore client-supplied values | T1 | Yes |
| G3 | MUST issue a `clientSecret` that is single-use, bound to one intent, and expires in 15 minutes or less | T2, T8 | Yes |
| G4 | MUST NOT accept long-lived merchant credentials from client SDKs | T2 | Yes |
| G5 | MUST scope every credential to one merchant, and reject access to another merchant's objects | T2, T7 | Yes |
| G6 | MUST support secret key and webhook secret rotation without downtime | T2, T3 | No |

## Validation

| ID | Requirement | Threats | Mock |
|---|---|---|---|
| G7 | MUST validate every request server-side, whatever the SDK checked | T13 | Yes |
| G8 | MUST enforce size limits on bodies, strings and metadata | T13 | Yes |
| G9 | MUST only call Apple validation hosts on an allowlist, and MUST NOT follow redirects to other hosts | T7 | Partial: checks the allowlist, makes no Apple calls |
| G10 | MUST take the validation domain from the merchant's verified domains, not from client input alone | T7 | Yes |

## Token handling

| ID | Requirement | Threats | Mock |
|---|---|---|---|
| G11 | MUST verify the Apple Pay token signature and certificate chain, and check its freshness, as Apple's documentation specifies | T8 | No: fake tokens only |
| G12 | MUST confirm that the decrypted amount and currency match the intent | T1 | Partial: fake tokens only |
| G13 | MUST keep decryption keys in an HSM or equivalent managed key store | T15 | No |
| G14 | MUST NOT log tokens, decrypted card data, `clientSecret` values or session tokens | T5, T9 | Yes |

## Replay protection

| ID | Requirement | Threats | Mock |
|---|---|---|---|
| G15 | MUST bind each idempotency key to a hash of the request and return 409 if the payload differs | T8 | Yes |
| G16 | MUST return the original result when the same key and payload are repeated | T8 | Yes |
| G17 | MUST accept each Apple `transactionId` at most once, using durable storage | T8 | In-memory only |
| G18 | MUST expose a status lookup so that clients and merchants can resolve an ambiguous result | T3, T8 | Yes |

## Confirmation

| ID | Requirement | Threats | Mock |
|---|---|---|---|
| G19 | MUST send webhooks signed with HMAC-SHA-256, covering the timestamp and raw body | T3 | Yes |
| G20 | MUST retry undelivered webhooks with backoff | T3 | No |
| G21 | MUST document that merchants fulfil orders from webhooks or status lookups only | T3 | Docs |

## Transport

| ID | Requirement | Threats | Mock |
|---|---|---|---|
| G22 | MUST serve TLS 1.2 or later only, with HSTS | T6 | Yes, when TLS is enabled |
| G23 | MUST present the Apple merchant identity certificate only on calls to allowlisted Apple hosts | T7 | No |
| G24 | SHOULD allow CORS only from the intent's registered origins | T6, T7 | Yes |

## Operations

| ID | Requirement | Threats | Mock |
|---|---|---|---|
| G25 | MUST rate-limit by merchant and by client IP | T2 | Basic |
| G26 | SHOULD return a request ID with every response | T3 | Yes |
| G27 | MUST keep audit logs of credential use and payment state changes | T3 | No |
