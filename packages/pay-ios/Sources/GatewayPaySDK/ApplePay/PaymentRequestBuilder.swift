import Foundation
import PassKit

enum PaymentRequestBuilder {
    static func build(request: PaymentRequest, session: MerchantSession) -> PKPaymentRequest {
        let r = PKPaymentRequest()
        r.merchantIdentifier   = session.appleMerchantId
        r.countryCode          = request.countryCode
        r.currencyCode         = request.total.currency
        r.merchantCapabilities = session.merchantCapabilities.toPK()
        r.supportedNetworks    = request.supportedNetworks?.toPK() ?? session.supportedNetworks.toPK()

        if let countries = request.supportedCountries {
            r.supportedCountries = Set(countries)
        }

        // Apple Pay wants major-unit decimals; PaymentRequest carries minor units, so divide by 100.
        let totalItem = PKPaymentSummaryItem(
            label: session.displayName,
            amount: NSDecimalNumber(value: Double(request.total.amount) / 100.0),
            type: .final
        )

        var items: [PKPaymentSummaryItem] = request.lineItems?.map { line in
            PKPaymentSummaryItem(
                label: line.label,
                amount: NSDecimalNumber(value: Double(line.amount) / 100.0),
                type: line.type == .pending ? .pending : .final
            )
        } ?? []
        items.append(totalItem)
        r.paymentSummaryItems = items

        if let billing = request.requiredBillingContactFields {
            r.requiredBillingContactFields = Set(billing.map { $0.toPK() })
        }
        if let shipping = request.requiredShippingContactFields {
            r.requiredShippingContactFields = Set(shipping.map { $0.toPK() })
        }

        return r
    }
}

private extension ContactField {
    func toPK() -> PKContactField {
        switch self {
        case .postalAddress: return .postalAddress
        case .name:          return .name
        case .phoneNumber:   return .phoneNumber
        case .emailAddress:  return .emailAddress
        }
    }
}