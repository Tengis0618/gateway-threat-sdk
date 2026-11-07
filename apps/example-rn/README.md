# example-rn

Minimal React Native demo of `@gateway/pay-react-native`. Because RN's `ios/` and `android/` folders are project scaffolds (they contain Xcode/Gradle project files that are usually generated per-machine), this folder ships only the JS/TS layer plus config. You bootstrap the native shells locally.

## Bootstrap (once)

From this folder:

```bash
pnpm install
npx @react-native-community/cli init ExampleRN --skip-install --directory .tmp
```

Copy the generated `.tmp/ios/` (and `android/` if you want the Android fallback later) into this directory, then delete `.tmp/`. Keep the `App.tsx`, `index.js`, `app.json`, `babel.config.js`, `metro.config.js`, `package.json`, and `tsconfig.json` files that already ship here — the RN scaffold's copies are just placeholders.

Then:

```bash
cd ios && pod install && cd ..
```

The RN podfile picks up `@gateway/pay-react-native` via autolinking, which in turn depends on `GatewayPaySDK` (the podspec at `packages/pay-ios/GatewayPaySDK.podspec`).

## Run

```bash
pnpm start           # Metro bundler
pnpm ios             # Xcode simulator build
```

## Android

`pay-android` (the Custom-Tab-based Apple Pay web-checkout Kotlin SDK) is deferred to a later milestone — Google Pay is being considered as the primary Android path instead. Until then, the RN wrapper's Android fallback in [packages/pay-react-native/src/index.ts:41](../../packages/pay-react-native/src/index.ts#L41) opens `opts.webCheckoutUrl` via `Linking.openURL` and throws `ApplePayUnavailable` — enough for a smoke test, but not a real payment flow.

## Environment

Copy `.env.example` to `.env.local` and `ios/Secrets.example.xcconfig` to `ios/Secrets.xcconfig`, then fill in both. Both are git-ignored. `scripts/generate-env.js` writes the JS values to `env.generated.ts` when you run `start`, `ios` or `typecheck`. Run `pod install` after creating `ios/Secrets.xcconfig`.

## Known constraint

The iOS bridge in `packages/pay-react-native/ios/GatewayPayModule.{swift,m}` still has markdown escape artifacts (`\_`, `-&gt;`, `\*`) that were carried over from the spec doc. Strip them (search-and-replace `\_` → `_`, `-&gt;` → `->`, `\*` → `*`) before `pod install` will produce a compilable pod.