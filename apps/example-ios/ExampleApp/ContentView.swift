// xcode: set sdk=iOS

import SwiftUI
import PassKit
import GatewayPaySDK

struct ContentView: View {
    @State private var status: String = "Idle"
    @State private var busy: Bool = false

    private let sdk = GatewayPaySDK(
        apiKey: ContentView.apiKey,
        environment: .sandbox,
        baseURL: ContentView.baseURL,
        headerPrefix: ContentView.configValue(env: "GATEWAY_HEADER_PREFIX", plist: "GatewayHeaderPrefix")
    )

    /// Reads a scheme environment variable first, then the value from Secrets.xcconfig.
    private static func configValue(env: String, plist: String) -> String? {
        if let value = ProcessInfo.processInfo.environment[env], !value.isEmpty {
            return value
        }
        if let value = Bundle.main.object(forInfoDictionaryKey: plist) as? String,
           !value.isEmpty, !value.hasPrefix("$(") {
            return value
        }
        return nil
    }

    private static var baseURL: URL {
        guard let value = configValue(env: "GATEWAY_BASE_URL", plist: "GatewayBaseURL"),
              let url = URL(string: value) else {
            fatalError("Set GATEWAY_BASE_URL in apps/example-ios/Secrets.xcconfig")
        }
        return url
    }

    private static var apiKey: String {
        configValue(env: "GATEWAY_KEY", plist: "GatewayAPIKey") ?? "pk_sandbox_demo"
    }

    var body: some View {
        VStack(spacing: 24) {
            Text("Gateway Pay demo")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Pay via Apple Pay.")
                .foregroundStyle(.secondary)

            PaymentButton(disabled: busy) {
                pay()
            }
            .frame(width: 220, height: 44)

            Text(status)
                .font(.system(.footnote, design: .monospaced))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .padding(24)
    }

    private func pay() {
        busy = true
        status = "Contacting gateway…"

        let request = PaymentRequest(
            reference: "DEMO-\(UUID().uuidString.prefix(6))",
            total: Money(currency: "MNT", amount: 1000),
            description: "Demo coffee", countryCode: "MN"
        )

        sdk.authorize(request) { result in
            DispatchQueue.main.async {
                busy = false
                switch result {
                case .success(let response):
                    status = "\(response.status.rawValue)  id=\(response.id)"
                case .failure(let error):
                    status = "[\(error.code.rawValue)] \(error.message)"
                }
            }
        }
    }
}

struct PaymentButton: UIViewRepresentable {
    let disabled: Bool
    let action: () -> Void

    func makeUIView(context: Context) -> PKPaymentButton {
        let button = PKPaymentButton(paymentButtonType: .buy, paymentButtonStyle: .black)
        button.addAction(UIAction { _ in action() }, for: .touchUpInside)
        return button
    }

    func updateUIView(_ uiView: PKPaymentButton, context: Context) {
        uiView.isEnabled = !disabled && GatewayPaySDK.canMakePayments()
    }
}

#Preview {
    ContentView()
}
