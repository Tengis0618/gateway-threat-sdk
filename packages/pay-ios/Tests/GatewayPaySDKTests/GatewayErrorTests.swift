import XCTest
@testable import GatewayPaySDK

final class GatewayErrorTests: XCTestCase {
    func testHTTPStatusMapping() {
        let empty = Data("{}".utf8)
        XCTAssertEqual(GatewayError.from(status: 401, body: empty).code, .invalidApiKey)
        XCTAssertEqual(GatewayError.from(status: 402, body: empty).code, .declined)
        XCTAssertEqual(GatewayError.from(status: 403, body: empty).code, .sessionExpired)
        XCTAssertEqual(GatewayError.from(status: 422, body: empty).code, .validationFailed)
        XCTAssertEqual(GatewayError.from(status: 429, body: empty).code, .rateLimited)
        XCTAssertEqual(GatewayError.from(status: 500, body: empty).code, .internalError)
        XCTAssertEqual(GatewayError.from(status: 418, body: empty).code, .internalError)
    }

    func testCapturesHTTPStatus() {
        let err = GatewayError.from(status: 429, body: Data("{}".utf8))
        XCTAssertEqual(err.httpStatus, 429)
    }

    func testBodyMessageAndRequestIdAreExtracted() {
        let body = Data(#"{"message":"reference is required","requestId":"req_abc"}"#.utf8)
        let err = GatewayError.from(status: 422, body: body)
        XCTAssertEqual(err.message, "reference is required")
        XCTAssertEqual(err.requestId, "req_abc")
    }

    func testFallsBackToStatusStringWhenBodyIsNotJSON() {
        let err = GatewayError.from(status: 500, body: Data("not json".utf8))
        XCTAssertEqual(err.message, "HTTP 500")
        XCTAssertNil(err.requestId)
    }

    func testNetworkFactoryDistinguishesTimeout() {
        let timeout = URLError(.timedOut)
        XCTAssertEqual(GatewayError.network(timeout).code, .timeout)

        let dropped = URLError(.notConnectedToInternet)
        XCTAssertEqual(GatewayError.network(dropped).code, .networkError)
    }

    func testValidationFactory() {
        let err = GatewayError.validation("reference too long")
        XCTAssertEqual(err.code, .validationFailed)
        XCTAssertEqual(err.message, "reference too long")
    }

    func testStaticSingletons() {
        XCTAssertEqual(GatewayError.userCancelled.code, .userCancelled)
        XCTAssertEqual(GatewayError.applePayUnavailable.code, .applePayUnavailable)
    }

    func testLocalizedDescriptionMatchesMessage() {
        let err = GatewayError(code: .declined, message: "Card declined")
        XCTAssertEqual(err.errorDescription, "Card declined")
    }
}