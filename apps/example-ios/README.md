# example-ios

Minimal SwiftUI demo of `GatewayPaySDK`. Because an Xcode project is a binary directory (`.xcodeproj` contains a `project.pbxproj` that Xcode owns), this folder ships only the Swift sources, the Podfile, and the entitlements template. You bootstrap the project in Xcode.

## Bootstrap (once)

1. In Xcode → **File → New → Project → App**:
   - Product Name: `ExampleApp`
   - Interface: **SwiftUI**
   - Language: **Swift**
   - iOS Deployment Target: **15.0**
   - Save to `apps/example-ios/` (uncheck "Create Git repository")

2. Delete the auto-generated `ExampleAppApp.swift` and `ContentView.swift`. Replace them with the copies checked in here at [ExampleApp/ExampleAppApp.swift](ExampleApp/ExampleAppApp.swift) and [ExampleApp/ContentView.swift](ExampleApp/ContentView.swift).

3. In the target's **Signing & Capabilities**:
   - Add the **Apple Pay** capability.
   - Reference the checked-in [ExampleApp/ExampleApp.entitlements](ExampleApp/ExampleApp.entitlements) — it reads the merchant ID from `GATEWAY_MERCHANT_ID` in `Secrets.xcconfig`.

4. Close Xcode. From this folder:

   ```bash
   pod install
   ```

   From now on open `ExampleApp.xcworkspace` (the workspace CocoaPods generated), not the raw `.xcodeproj`.

## Run

- Open `ExampleApp.xcworkspace`.
- Select an iPhone simulator (Apple Pay works in the simulator with test cards from Wallet) or a real device with a linked Apple Pay card.
- **Product → Scheme → Edit Scheme → Run → Arguments → Environment Variables** → set `GATEWAY_KEY` and `GATEWAY_BASE_URL`, or fill in `Secrets.xcconfig` (see `Secrets.example.xcconfig`).
- ⌘R.

## Apple Pay entitlement

Your merchant ID may be owned by the gateway's Apple Developer team, not yours. To actually complete a payment sheet against Apple's servers you must either:

- be a member of the gateway's team (they'll add you and provision the ID for your device), or
- provision your own merchant ID in your own team, update the entitlement, and register that ID with the gateway backend.

Without a valid merchant-ID setup, `PKPaymentAuthorizationController` returns `false` for `canMakePayments()` and the "Pay with Apple Pay" button fails to present the sheet.

## Local pay-ios (not a released pod)

The Podfile points at `../../packages/pay-ios` via `:path`, so it consumes your working-tree changes directly. If you want to point at a released tag from CocoaPods trunk instead, swap the line for `pod 'GatewayPaySDK', '~> 2.0'`.
