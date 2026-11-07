import Foundation
import PassKit

/// Wraps `POST /v1/applepay/validate-merchant`.
///
/// PassKit performs merchant validation transparently for standard Apple Pay flows, so this
/// validator is used only for the (rare) case of refreshing a merchant session mid-flow via
/// `paymentAuthorizationController(_:didRequestMerchantSessionUpdate:)`, and for parity with
/// the web SDK's manual `onvalidatemerchant` path.
final class MerchantValidator {
    private let http: HTTPClient
    private let domain: String
    private let displayName: String

    init(http: HTTPClient, domain: String, displayName: String) {
        self.http = http
        self.domain = domain
        self.displayName = displayName
    }

    func validate(validationURL: URL) async throws -> ApplePayMerchantSession {
        try await http.validateMerchant(
            validationURL: validationURL,
            domain: domain,
            displayName: displayName
        )
    }
}