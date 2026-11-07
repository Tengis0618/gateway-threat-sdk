import Foundation
import PassKit

public struct ApplePayToken: Codable, Equatable, Sendable {
    public struct PaymentData: Codable, Equatable, Sendable {
        public enum Version: String, Codable, Sendable {
            case ec  = "EC_v1"
            case rsa = "RSA_v1"
        }

        public struct Header: Codable, Equatable, Sendable {
            public let ephemeralPublicKey: String?
            public let wrappedKey: String?
            public let publicKeyHash: String
            public let transactionId: String

            public init(ephemeralPublicKey: String?, wrappedKey: String?, publicKeyHash: String, transactionId: String) {
                self.ephemeralPublicKey = ephemeralPublicKey
                self.wrappedKey = wrappedKey
                self.publicKeyHash = publicKeyHash
                self.transactionId = transactionId
            }
        }

        public let version: Version
        public let data: String
        public let signature: String
        public let header: Header

        public init(version: Version, data: String, signature: String, header: Header) {
            self.version = version
            self.data = data
            self.signature = signature
            self.header = header
        }
    }

    public struct PaymentMethod: Codable, Equatable, Sendable {
        public enum MethodType: String, Codable, Sendable {
            case debit
            case credit
            case prepaid
            case store
        }

        public let displayName: String
        public let network: String
        public let type: MethodType

        public init(displayName: String, network: String, type: MethodType) {
            self.displayName = displayName
            self.network = network
            self.type = type
        }
    }

    public let paymentData: PaymentData
    public let paymentMethod: PaymentMethod
    public let transactionIdentifier: String

    public init(paymentData: PaymentData, paymentMethod: PaymentMethod, transactionIdentifier: String) {
        self.paymentData = paymentData
        self.paymentMethod = paymentMethod
        self.transactionIdentifier = transactionIdentifier
    }
}

public extension ApplePayToken {
    /// Extracts the wire representation from a PKPayment produced by PassKit.
    /// PKPayment.token.paymentData is a UTF-8 JSON blob whose shape matches PaymentData exactly.
    init(payment: PKPayment) {
        let rawData = payment.token.paymentData
        let parsed = (try? JSONSerialization.jsonObject(with: rawData, options: [])) as? [String: Any] ?? [:]
        let rawHeader = parsed["header"] as? [String: Any] ?? [:]

        let paymentData = PaymentData(
            version: PaymentData.Version(rawValue: parsed["version"] as? String ?? "") ?? .ec,
            data: parsed["data"] as? String ?? "",
            signature: parsed["signature"] as? String ?? "",
            header: PaymentData.Header(
                ephemeralPublicKey: rawHeader["ephemeralPublicKey"] as? String,
                wrappedKey: rawHeader["wrappedKey"] as? String,
                publicKeyHash: rawHeader["publicKeyHash"] as? String ?? "",
                transactionId: rawHeader["transactionId"] as? String ?? ""
            )
        )

        let pkMethod = payment.token.paymentMethod
        let method = PaymentMethod(
            displayName: pkMethod.displayName ?? "",
            network: pkMethod.network?.rawValue ?? "",
            type: PaymentMethod.MethodType(from: pkMethod.type)
        )

        self.init(
            paymentData: paymentData,
            paymentMethod: method,
            transactionIdentifier: payment.token.transactionIdentifier
        )
    }
}

private extension ApplePayToken.PaymentMethod.MethodType {
    init(from pk: PKPaymentMethodType) {
        switch pk {
        case .debit:   self = .debit
        case .credit:  self = .credit
        case .prepaid: self = .prepaid
        case .store:   self = .store
        default:       self = .credit
        }
    }
}