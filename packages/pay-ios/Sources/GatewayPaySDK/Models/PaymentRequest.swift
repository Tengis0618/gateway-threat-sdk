import Foundation

public struct Money: Codable, Equatable, Sendable {
    public let currency: String
    public let amount: Int

    public init(currency: String, amount: Int) {
        self.currency = currency
        self.amount = amount
    }
}

public struct LineItem: Codable, Equatable, Sendable {
    public enum ItemType: String, Codable, Sendable {
        case final
        case pending
    }

    public let label: String
    public let amount: Int
    public let type: ItemType?

    public init(label: String, amount: Int, type: ItemType? = nil) {
        self.label = label
        self.amount = amount
        self.type = type
    }
}

public enum PaymentNetwork: String, Codable, CaseIterable, Sendable {
    case visa
    case mastercard
    case amex
    case discover
    case interac
    case jcb
    case unionpay
    case mada
    case elo
}

public enum ContactField: String, Codable, CaseIterable, Sendable {
    case postalAddress
    case name
    case phoneNumber
    case emailAddress
}

public struct PaymentRequest: Codable, Equatable, Sendable {
    public let idempotencyKey: String?
    public let reference: String
    public let total: Money
    public let lineItems: [LineItem]?
    public let description: String?
    public let countryCode: String
    public let supportedCountries: [String]?
    public let supportedNetworks: [PaymentNetwork]?
    public let requiredBillingContactFields: [ContactField]?
    public let requiredShippingContactFields: [ContactField]?
    public let metadata: [String: String]?

    public init(
        idempotencyKey: String? = nil,
        reference: String,
        total: Money,
        lineItems: [LineItem]? = nil,
        description: String? = nil,
        countryCode: String,
        supportedCountries: [String]? = nil,
        supportedNetworks: [PaymentNetwork]? = nil,
        requiredBillingContactFields: [ContactField]? = nil,
        requiredShippingContactFields: [ContactField]? = nil,
        metadata: [String: String]? = nil
    ) {
        self.idempotencyKey = idempotencyKey
        self.reference = reference
        self.total = total
        self.lineItems = lineItems
        self.description = description
        self.countryCode = countryCode
        self.supportedCountries = supportedCountries
        self.supportedNetworks = supportedNetworks
        self.requiredBillingContactFields = requiredBillingContactFields
        self.requiredShippingContactFields = requiredShippingContactFields
        self.metadata = metadata
    }
}

public extension PaymentRequest {
    /// Bridges an NSDictionary (e.g. the payload the RN bridge hands over) into a strongly-typed request.
    init(dictionary: NSDictionary) throws {
        let data = try JSONSerialization.data(withJSONObject: dictionary, options: [])
        self = try JSONDecoder.gateway.decode(PaymentRequest.self, from: data)
    }
}