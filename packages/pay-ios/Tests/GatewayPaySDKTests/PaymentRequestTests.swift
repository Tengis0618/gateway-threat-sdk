import XCTest
@testable import GatewayPaySDK

final class PaymentRequestTests: XCTestCase {
    func testMinimalRequestEncodesOnlyProvidedFields() throws {
        let request = PaymentRequest(
            reference: "ORDER-1042",
            total: Money(currency: "USD", amount: 4999),
            countryCode: "US"
        )
        let data = try JSONEncoder.gateway.encode(request)
        let dict = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertEqual(dict["reference"] as? String, "ORDER-1042")
        XCTAssertEqual(dict["countryCode"] as? String, "US")

        let total = try XCTUnwrap(dict["total"] as? [String: Any])
        XCTAssertEqual(total["currency"] as? String, "USD")
        XCTAssertEqual(total["amount"] as? Int, 4999)

        XCTAssertNil(dict["idempotencyKey"])
        XCTAssertNil(dict["lineItems"])
        XCTAssertNil(dict["metadata"])
    }

    func testCodableRoundTripPreservesAllFields() throws {
        let original = PaymentRequest(
            idempotencyKey: "6f8e0b6a-2e57-4d5f-8a5d-6c9b6b1a2f3e",
            reference: "ORDER-42",
            total: Money(currency: "EUR", amount: 12_300),
            lineItems: [
                LineItem(label: "T-shirt", amount: 10_000, type: .final),
                LineItem(label: "Shipping", amount: 2_300, type: .pending)
            ],
            description: "Autumn drop",
            countryCode: "FR",
            supportedCountries: ["FR", "DE", "NL"],
            supportedNetworks: [.visa, .mastercard, .amex],
            requiredBillingContactFields: [.postalAddress, .emailAddress],
            requiredShippingContactFields: [.postalAddress],
            metadata: ["orderId": "42", "channel": "web"]
        )

        let encoded = try JSONEncoder.gateway.encode(original)
        let decoded = try JSONDecoder.gateway.decode(PaymentRequest.self, from: encoded)
        XCTAssertEqual(decoded, original)
    }

    func testDictionaryInitializerBridgesRNPayload() throws {
        let dict: NSDictionary = [
            "reference": "ORD-1",
            "total": ["currency": "USD", "amount": 100],
            "countryCode": "US",
            "supportedNetworks": ["visa", "mastercard"],
            "metadata": ["k": "v"]
        ]

        let request = try PaymentRequest(dictionary: dict)
        XCTAssertEqual(request.reference, "ORD-1")
        XCTAssertEqual(request.total, Money(currency: "USD", amount: 100))
        XCTAssertEqual(request.countryCode, "US")
        XCTAssertEqual(request.supportedNetworks, [.visa, .mastercard])
        XCTAssertEqual(request.metadata, ["k": "v"])
    }

    func testDictionaryInitializerThrowsOnMissingRequiredField() {
        let dict: NSDictionary = [
            "reference": "ORD-1"
            // Missing total + countryCode
        ]
        XCTAssertThrowsError(try PaymentRequest(dictionary: dict))
    }
}