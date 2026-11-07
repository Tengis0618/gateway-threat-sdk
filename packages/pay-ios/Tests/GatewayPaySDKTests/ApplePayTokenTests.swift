import XCTest
@testable import GatewayPaySDK

final class ApplePayTokenTests: XCTestCase {
    func testCodableRoundTripPreservesFields() throws {
        let token = ApplePayToken(
            paymentData: ApplePayToken.PaymentData(
                version: .ec,
                data: "base64Data==",
                signature: "base64Sig==",
                header: ApplePayToken.PaymentData.Header(
                    ephemeralPublicKey: "ephKey",
                    wrappedKey: nil,
                    publicKeyHash: "hash",
                    transactionId: "tx1"
                )
            ),
            paymentMethod: ApplePayToken.PaymentMethod(
                displayName: "Visa •••• 1234",
                network: "visa",
                type: .credit
            ),
            transactionIdentifier: "tx1"
        )

        let encoded = try JSONEncoder.gateway.encode(token)
        let decoded = try JSONDecoder.gateway.decode(ApplePayToken.self, from: encoded)
        XCTAssertEqual(decoded, token)
    }

    func testWireKeyNamesMatchApplePayJSFormat() throws {
        let token = ApplePayToken(
            paymentData: ApplePayToken.PaymentData(
                version: .rsa,
                data: "d",
                signature: "s",
                header: ApplePayToken.PaymentData.Header(
                    ephemeralPublicKey: nil,
                    wrappedKey: "wk",
                    publicKeyHash: "h",
                    transactionId: "t"
                )
            ),
            paymentMethod: ApplePayToken.PaymentMethod(
                displayName: "Card",
                network: "mastercard",
                type: .debit
            ),
            transactionIdentifier: "t"
        )

        let data = try JSONEncoder.gateway.encode(token)
        let dict = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])

        let paymentData = try XCTUnwrap(dict["paymentData"] as? [String: Any])
        XCTAssertEqual(paymentData["version"] as? String, "RSA_v1")

        let header = try XCTUnwrap(paymentData["header"] as? [String: Any])
        XCTAssertEqual(header["wrappedKey"] as? String, "wk")
        XCTAssertNil(header["ephemeralPublicKey"])

        let method = try XCTUnwrap(dict["paymentMethod"] as? [String: Any])
        XCTAssertEqual(method["type"] as? String, "debit")
    }
}