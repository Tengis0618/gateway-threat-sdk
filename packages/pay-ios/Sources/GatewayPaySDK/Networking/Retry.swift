import Foundation

/// Wraps an async operation with exponential-backoff retries. Only network-class failures
/// (`GatewayError.networkError`, `.timeout`) are retried — validation, auth, and business
/// errors surface immediately so callers don't wait on requests that will never succeed.
enum Retry {
    static func withBackoff<T>(
        maxAttempts: Int = 3,
        baseDelayMs: Double = 250,
        maxJitterMs: Double = 100,
        _ operation: @escaping () async throws -> T
    ) async throws -> T {
        var attempt = 0
        while true {
            do {
                return try await operation()
            } catch let error as GatewayError where error.code == .networkError || error.code == .timeout {
                attempt += 1
                if attempt >= maxAttempts { throw error }

                let backoff = baseDelayMs * pow(2.0, Double(attempt - 1))
                let jitter  = Double.random(in: 0...maxJitterMs)
                let delayNs = UInt64((backoff + jitter) * 1_000_000)
                try await Task.sleep(nanoseconds: delayNs)
            }
        }
    }
}