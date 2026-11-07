import XCTest
@testable import GatewayPaySDK

final class RetryTests: XCTestCase {
    func testReturnsImmediatelyOnSuccess() async throws {
        var calls = 0
        let result: Int = try await Retry.withBackoff(maxAttempts: 3, baseDelayMs: 1, maxJitterMs: 1) {
            calls += 1
            return 42
        }
        XCTAssertEqual(result, 42)
        XCTAssertEqual(calls, 1)
    }

    func testRetriesOnNetworkErrorThenSucceeds() async throws {
        var calls = 0
        let result: String = try await Retry.withBackoff(maxAttempts: 3, baseDelayMs: 1, maxJitterMs: 1) {
            calls += 1
            if calls < 3 {
                throw GatewayError.network(URLError(.notConnectedToInternet))
            }
            return "ok"
        }
        XCTAssertEqual(result, "ok")
        XCTAssertEqual(calls, 3)
    }

    func testRetriesOnTimeout() async throws {
        var calls = 0
        _ = try await Retry.withBackoff(maxAttempts: 2, baseDelayMs: 1, maxJitterMs: 1) { () -> Int in
            calls += 1
            if calls < 2 { throw GatewayError.network(URLError(.timedOut)) }
            return 1
        }
        XCTAssertEqual(calls, 2)
    }

    func testGivesUpAfterMaxAttempts() async {
        var calls = 0
        do {
            _ = try await Retry.withBackoff(maxAttempts: 2, baseDelayMs: 1, maxJitterMs: 1) { () -> Int in
                calls += 1
                throw GatewayError.network(URLError(.notConnectedToInternet))
            }
            XCTFail("Expected the retry to give up and rethrow")
        } catch let error as GatewayError {
            XCTAssertEqual(error.code, .networkError)
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
        XCTAssertEqual(calls, 2)
    }

    func testDoesNotRetryOnValidationError() async {
        var calls = 0
        do {
            _ = try await Retry.withBackoff(maxAttempts: 3, baseDelayMs: 1, maxJitterMs: 1) { () -> Int in
                calls += 1
                throw GatewayError.validation("bad")
            }
            XCTFail("Expected the validation error to propagate on the first attempt")
        } catch let error as GatewayError {
            XCTAssertEqual(error.code, .validationFailed)
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
        XCTAssertEqual(calls, 1)
    }

    func testDoesNotRetryOnInvalidApiKey() async {
        var calls = 0
        do {
            _ = try await Retry.withBackoff(maxAttempts: 3, baseDelayMs: 1, maxJitterMs: 1) { () -> Int in
                calls += 1
                throw GatewayError.from(status: 401, body: Data("{}".utf8))
            }
            XCTFail("Expected the auth error to propagate on the first attempt")
        } catch let error as GatewayError {
            XCTAssertEqual(error.code, .invalidApiKey)
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
        XCTAssertEqual(calls, 1)
    }
}