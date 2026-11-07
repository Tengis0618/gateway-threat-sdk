# ADR 0001: Payment intents instead of client API keys

**Status:** Accepted

## Context

Client SDKs currently hold a long-lived bearer API key and send the payment amount from the client. Both the browser and the app are controlled by the customer, so neither value can be trusted (T1, T2). The result of a payment also ends at the client (T3).

## Decision

The merchant server creates a payment intent using a secret key. The gateway fixes the amount, currency, reference and allowed origin, then returns a short-lived, single-use `clientSecret`. The SDK receives only that value. The merchant fulfils the order from a signed webhook or a server-side lookup.

## Consequences

- No long-lived credential ships in a client, and a client can't change the amount.
- Every merchant now needs a server-side step, so a purely static site can't integrate on its own.
- This is a breaking API change for all three SDKs. It lands before v0.1 so that no public release has the old model.
- A stolen `clientSecret` is limited to one intent, at a fixed amount, for a short time.

## Alternatives considered

- **Restricted publishable key plus domain checks:** this reduces the damage from a leaked key, but the client still states the amount, so T1 remains.
- **Merchant server signs the order for the client to forward:** this protects integrity, but it adds signing and key handling for each merchant and doesn't provide single use by itself.
