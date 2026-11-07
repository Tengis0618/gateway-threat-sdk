import XCTest
import PassKit
@testable import GatewayPaySDK

final class MerchantSessionTests: XCTestCase {
    func testDecodesWireFormat() throws {
        let wire = Data("""
        {
          "sessionToken": "st_abc",
          "appleMerchantId": "merchant.com.yourgateway.payments",
          "displayName": "Gateway Merchant",
          "supportedNetworks": ["visa", "mastercard"],
          "merchantCapabilities": ["supports3DS", "supportsCredit"],
          "expiresAt": "2026-07-09T00:15:00Z",
          "environment": "sandbox"
        }
        """.utf8)

        let session = try JSONDecoder.gateway.decode(MerchantSession.self, from: wire)
        XCTAssertEqual(session.sessionToken, "st_abc")
        XCTAssertEqual(session.appleMerchantId, "merchant.com.yourgateway.payments")
        XCTAssertEqual(session.merchantCapabilities, [.supports3DS, .supportsCredit])
        XCTAssertEqual(session.environment, .sandbox)
    }

    func testCapabilitiesMapToPassKit() {
        let caps: [ApplePayCapability] = [.supports3DS, .supportsCredit]
        let pk = caps.toPK()
        XCTAssertTrue(pk.contains(.capability3DS))
        XCTAssertTrue(pk.contains(.capabilityCredit))
        XCTAssertFalse(pk.contains(.capabilityDebit))
        XCTAssertFalse(pk.contains(.capabilityEMV))
    }

    func testSupportedNetworksMapToPassKit() {
        let networks: [PaymentNetwork] = [.visa, .mastercard, .amex]
        let pk = networks.toPK()
        XCTAssertTrue(pk.contains(.visa))
        XCTAssertTrue(pk.contains(.masterCard))
        XCTAssertTrue(pk.contains(.amex))
    }

    func testStringNetworksFilterOutUnknownValues() {
        let raw: [String] = ["visa", "not-a-real-network", "mastercard"]
        XCTAssertEqual(raw.toPK(), [.visa, .masterCard])
    }

    func testApplePayMerchantSessionDecodes() throws {
        let wire = Data(#"{"merchantSession":"opaque-apple-blob"}"#.utf8)
        let session = try JSONDecoder.gateway.decode(ApplePayMerchantSession.self, from: wire)
        XCTAssertEqual(session.merchantSession, "opaque-apple-blob")
    }
}