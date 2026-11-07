# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Gateway Pay SDK: client SDKs for taking Apple Pay payments through a payment gateway, for web, iOS and React Native. [Developer-Doc.md](Developer-Doc.md) has full per-package setup and a troubleshooting table; [Merchant-Doc.md](Merchant-Doc.md) is the merchant integration guide.

## Commands

pnpm 9 + Turborepo workspace (Node >= 20.10). Run from the repo root unless noted. There is no root `test` or `typecheck` script.

```bash
pnpm install
pnpm build                                   # all packages; pay-core builds first
pnpm turbo run test                          # all JS tests
pnpm turbo run typecheck
pnpm --filter @gateway/pay-web... build      # one package plus its dependencies
```

Single test, per package (`core` and `pay-web` use vitest; `pay-react-native` uses jest):

```bash
pnpm --filter @gateway/pay-core exec vitest run src/http/__tests__/retry.test.ts -t "<name>"
pnpm --filter @gateway/pay-web exec vitest run src/__tests__/GatewayPay.test.ts -t "<name>"
pnpm --filter @gateway/pay-react-native exec jest src/__tests__/index.test.ts -t "<name>"
```

Swift SDK, from `packages/pay-ios`. `swift build` and `swift test` compile for the **macOS host**, not iOS, so macOS-only PassKit requirements stay behind `#if os(macOS)`:

```bash
swift test
swift test --filter RetryTests
xcodebuild -scheme GatewayPaySDK -destination 'generic/platform=iOS Simulator' build   # what apps actually use
```

Example apps need local setup (mkcert certificates, local gateway config, XcodeGen, signing), covered in Developer-Doc.md sections 9-11. `apps/example-ios/ExampleApp.xcodeproj` is generated: edit `project.yml` and re-run `xcodegen generate`.

Currently failing: `pnpm lint`. ESLint 9 finds no flat config, because `packages/core` has no `eslint.config.*` wiring in `tooling/eslint/index.js`. `core` is the only package with a `lint` script.

## Architecture

### Payment flow

Each SDK runs the same three-step exchange against the gateway:

1. `POST /v1/session` returns a `MerchantSession` (`sessionToken`, `appleMerchantId`, networks, capabilities). The session supplies these Apple Pay request values; a merchant can override only `supportedNetworks`, through `PaymentRequest`.
2. `POST /v1/validate-merchant`: **web only**, called from `onvalidatemerchant`. On iOS, PassKit handles validation with the entitlement's merchant ID.
3. `POST /v1/payments` sends `{request, token, sessionToken}` and returns a `PaymentResponse`.

Entry points are `packages/pay-web/src/GatewayPay.ts` (`ApplePaySession`) and `packages/pay-ios/Sources/GatewayPaySDK/GatewayPaySDK.swift` → `ApplePay/ApplePayCoordinator.swift` (`PKPaymentAuthorizationController`).

No gateway host is built in. `baseUrl` (web, React Native) and `baseURL` (iOS) are required and include any path prefix such as `/sdk/applepay`. `headerPrefix` sets the prefix of the two identification headers (default `X-Pay`).

Example apps read gateway URLs, merchant IDs, bundle IDs and team IDs from git-ignored local config: `.env.local` (web and React Native JS) and `Secrets.xcconfig` (iOS and React Native native). Keep real values there, never in tracked files. `apps/example-rn/env.generated.ts` is generated from `.env.local`.

### Packages and the two parallel implementations

- `packages/core` (`@gateway/pay-core`): TypeScript types, `GatewayError`/`ErrorCode`, zod schemas with `validate()`, and `HttpClient`.
- `packages/pay-web`: depends on core and does not re-export it, so consumers import types from `@gateway/pay-core`.
- `packages/pay-react-native`: a thin JS wrapper that re-exports core. It validates with core's schema, then delegates to the native module on iOS, so **its HTTP goes through Swift, not `HttpClient`**. On Android it only opens `webCheckoutUrl`. The bridge is `ios/GatewayPayModule.{swift,m}`, which depends on the `GatewayPaySDK` pod.
- `packages/pay-ios` (`GatewayPaySDK`): a standalone native implementation that shares no code with core.

**Any change to the API contract must be made in both TypeScript and Swift**: models, error codes and status mapping, headers and endpoints. They already differ: iOS maps HTTP 402 to `DECLINED` and sends an extra `X-Sdk-Version` header.

### Behaviours that aren't obvious from one file

- Amounts are minor units in the SDK; `packages/pay-web/src/applepay/request.ts` converts them to decimal strings and maps network names to Apple's casing (`mastercard` → `masterCard`).
- JS retries (`HttpClient.request`) apply only to `NetworkError` and `Timeout`, with 2 retries by default. `HttpClient.request` fixes the `Idempotency-Key` before the retry loop so every attempt sends the same key; keep it there, or a retried payment could be charged twice.
- Swift has no active retries: `Networking/Retry.swift` is tested but never called from `HTTPClient`. `ApplePay/MerchantValidator.swift` is also unused.
- `pay-react-native` jest maps `@gateway/pay-core` to its source, so those tests don't need core built. `pay-web` tests and `example-*` do resolve core's built output.
- tsup builds use `tsconfig.tsup.json` because the regular `tsconfig.json` is composite.

## Conventions

- TypeScript is strict with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. Pass optional fields with a conditional spread, `...(x !== undefined && { x })`, never as `undefined`.
- `dist/` and `lib/` are git-ignored build outputs. Run `pnpm build` after a fresh install, because `pay-web` tests and the example apps use the built packages.
- A full payment can't complete on `localhost` (the merchant session is bound to the verified domain) or on the iOS simulator (its token has empty `paymentData`). Use a verified domain or a real device to exercise those paths end to end.
