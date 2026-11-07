import Foundation

enum Endpoints {
    static let session = "/v1/session"
    static let validateMerchant = "/v1/validate-merchant"
    static let payments = "/v1/payments"
}

struct EmptyBody: Encodable {}

struct ValidateMerchantRequest: Encodable {
    let validationURL: String
    let domainName: String
    let displayName: String
}

struct AuthorizeBody: Encodable {
    let request: PaymentRequest
    let token: ApplePayToken
    let sessionToken: String
}