import Foundation
import PassKit

public enum ApplePayCapability: String, Codable, CaseIterable, Sendable {
    case supports3DS
    case supportsCredit
    case supportsDebit
    case supportsEMV
}

public struct MerchantSession: Codable, Equatable, Sendable {
    public let sessionToken: String
    public let appleMerchantId: String
    public let displayName: String
    public let supportedNetworks: [String]
    public let merchantCapabilities: [ApplePayCapability]
    public let expiresAt: String
    public let environment: GatewayEnvironment

    public init(
        sessionToken: String,
        appleMerchantId: String,
        displayName: String,
        supportedNetworks: [String],
        merchantCapabilities: [ApplePayCapability],
        expiresAt: String,
        environment: GatewayEnvironment
    ) {
        self.sessionToken = sessionToken
        self.appleMerchantId = appleMerchantId
        self.displayName = displayName
        self.supportedNetworks = supportedNetworks
        self.merchantCapabilities = merchantCapabilities
        self.expiresAt = expiresAt
        self.environment = environment
    }
}

public struct ApplePayMerchantSession: Codable, Equatable, Sendable {
    public let merchantSession: String

    public init(merchantSession: String) {
        self.merchantSession = merchantSession
    }
}

extension Array where Element == ApplePayCapability {
    func toPK() -> PKMerchantCapability {
        var caps: PKMerchantCapability = []
        for cap in self {
            switch cap {
            case .supports3DS:    caps.insert(.capability3DS)
            case .supportsCredit: caps.insert(.capabilityCredit)
            case .supportsDebit:  caps.insert(.capabilityDebit)
            case .supportsEMV:    caps.insert(.capabilityEMV)
            }
        }
        return caps
    }
}

extension Array where Element == PaymentNetwork {
    func toPK() -> [PKPaymentNetwork] {
        compactMap { $0.pkNetwork }
    }
}

extension Array where Element == String {
    func toPK() -> [PKPaymentNetwork] {
        compactMap { PaymentNetwork(rawValue: $0)?.pkNetwork }
    }
}

private extension PaymentNetwork {
    var pkNetwork: PKPaymentNetwork? {
        switch self {
        case .visa:       return .visa
        case .mastercard: return .masterCard
        case .amex:       return .amex
        case .discover:   return .discover
        case .interac:    return .interac
        case .jcb:        return .JCB
        case .unionpay:   return .chinaUnionPay
        case .mada:       return .mada
        case .elo:        return .elo
        }
    }
}