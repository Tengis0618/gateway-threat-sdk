import Foundation
import PassKit

public enum GatewayEnvironment: String, Codable, Sendable {
    case sandbox
    case production
}

public final class GatewayPaySDK {
    private let http: HTTPClient
    private let coordinator: ApplePayCoordinator
    private let apiKey: String

    public init(apiKey: String, environment: GatewayEnvironment, baseURL: URL, headerPrefix: String? = nil) {
        self.apiKey = apiKey
        self.http = HTTPClient(apiKey: apiKey, baseURL: baseURL, headerPrefix: headerPrefix ?? HTTPClient.defaultHeaderPrefix)
        self.coordinator = ApplePayCoordinator(http: http)
    }

    public static func canMakePayments() -> Bool {
        PKPaymentAuthorizationController.canMakePayments()
    }

    /// Opens a merchant session, presents the Apple Pay sheet, and forwards the
    /// encrypted token to the gateway. Completion fires exactly once with either
    /// the authorised PaymentResponse or a GatewayError.
    public func authorize(_ request: PaymentRequest,
                          completion: @escaping (Result<PaymentResponse, GatewayError>) -> Void) {
        guard Self.canMakePayments() else {
            completion(.failure(.applePayUnavailable))
            return
        }
        Task {
            do {
                let session = try await http.openSession()
                let apRequest = PaymentRequestBuilder.build(request: request, session: session)
                try await coordinator.present(
                    apRequest: apRequest,
                    request: request,
                    session: session,
                    completion: completion
                )
            } catch let err as GatewayError {
                completion(.failure(err))
            } catch {
                completion(.failure(.network(error)))
            }
        }
    }
}