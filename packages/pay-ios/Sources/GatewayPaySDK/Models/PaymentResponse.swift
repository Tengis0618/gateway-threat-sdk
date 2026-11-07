import Foundation

public enum PaymentStatus: String, Codable, Sendable {
    case authorized = "AUTHORIZED"
    case captured   = "CAPTURED"
    case failed     = "FAILED"
    case declined   = "DECLINED"
    case pending    = "PENDING"
}

public struct PaymentResponse: Codable, Equatable, Sendable {
    public let id: String
    public let status: PaymentStatus
    public let reference: String
    public let total: Money
    public let authorizedAt: String
    public let authorizationCode: String?
    public let declineReason: String?
    public let environment: GatewayEnvironment

    public init(
        id: String,
        status: PaymentStatus,
        reference: String,
        total: Money,
        authorizedAt: String,
        authorizationCode: String? = nil,
        declineReason: String? = nil,
        environment: GatewayEnvironment
    ) {
        self.id = id
        self.status = status
        self.reference = reference
        self.total = total
        self.authorizedAt = authorizedAt
        self.authorizationCode = authorizationCode
        self.declineReason = declineReason
        self.environment = environment
    }
}

public extension PaymentResponse {
    /// Serialises the response back into a JS-friendly dictionary for the RN bridge.
    func toDictionary() -> [String: Any] {
        guard let data = try? JSONEncoder.gateway.encode(self),
              let dict = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any]
        else {
            return [:]
        }
        return dict
    }
}