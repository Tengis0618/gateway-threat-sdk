import XCTest
@testable import GatewayPaySDK

final class PaymentResponseTests: XCTestCase {
    func testDecodesWireFormat() throws {
        let wire = Data("""
        {
          "id": "pmt_123",
          "status": "AUTHORIZED",
          "reference": "ORDER-1",
          "total": { "currency": "USD", "amount": 4999 },
          "authorizedAt": "2026-07-09T12:00:00Z",
          "authorizationCode": "AUTH_ABC",
          "environment": "sandbox"
        }
        """.utf8)

        let response = try JSONDecoder.gateway.decode(PaymentResponse.self, from: wire)
        XCTAssertEqual(response.id, "pmt_123")
        XCTAssertEqual(response.status, .authorized)
        XCTAssertEqual(response.reference, "ORDER-1")
        XCTAssertEqual(response.total, Money(currency: "USD", amount: 4999))
        XCTAssertEqual(response.environment, .sandbox)
        XCTAssertNil(response.declineReason)
    }

    func testToDictionaryProducesRNCompatiblePayload() throws {
        let response = PaymentResponse(
            id: "pmt_1",
            status: .captured,
            reference: "R",
            total: Money(currency: "USD", amount: 100),
            authorizedAt: "2026-07-09T00:00:00Z",
            authorizationCode: "A",
            declineReason: nil,
            environment: .production
        )

        let dict = response.toDictionary()
        XCTAssertEqual(dict["id"] as? String, "pmt_1")
        XCTAssertEqual(dict["status"] as? String, "CAPTURED")
        XCTAssertEqual(dict["environment"] as? String, "production")
        XCTAssertEqual(dict["authorizationCode"] as? String, "A")
        XCTAssertNil(dict["declineReason"])

        let total = try XCTUnwrap(dict["total"] as? [String: Any])
        XCTAssertEqual(total["currency"] as? String, "USD")
        XCTAssertEqual(total["amount"] as? Int, 100)
    }

    func testAllStatusesRoundTrip() throws {
        for status in [PaymentStatus.authorized, .captured, .failed, .declined, .pending] {
            let response = PaymentResponse(
                id: "id",
                status: status,
                reference: "r",
                total: Money(currency: "USD", amount: 1),
                authorizedAt: "2026-01-01T00:00:00Z",
                environment: .sandbox
            )
            let data = try JSONEncoder.gateway.encode(response)
            let decoded = try JSONDecoder.gateway.decode(PaymentResponse.self, from: data)
            XCTAssertEqual(decoded.status, status)
        }
    }
}