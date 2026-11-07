import Foundation

public struct GatewayError: LocalizedError, CustomStringConvertible {
    public enum Code: String, Sendable {
        case networkError        = "NETWORK_ERROR"
        case timeout             = "TIMEOUT"
        case invalidApiKey       = "INVALID_API_KEY"
        case sessionExpired      = "SESSION_EXPIRED"
        case validationFailed    = "VALIDATION_FAILED"
        case applePayUnavailable = "APPLE_PAY_UNAVAILABLE"
        case userCancelled       = "USER_CANCELLED"
        case declined            = "DECLINED"
        case internalError       = "INTERNAL"
        case rateLimited         = "RATE_LIMITED"
    }

    public let code: Code
    public let message: String
    public let httpStatus: Int?
    public let requestId: String?
    public let underlying: Error?

    public init(
        code: Code,
        message: String,
        httpStatus: Int? = nil,
        requestId: String? = nil,
        underlying: Error? = nil
    ) {
        self.code = code
        self.message = message
        self.httpStatus = httpStatus
        self.requestId = requestId
        self.underlying = underlying
    }

    public var errorDescription: String? { message }
    public var description: String { "[\(code.rawValue)] \(message)" }
}

public extension GatewayError {
    static let applePayUnavailable = GatewayError(
        code: .applePayUnavailable,
        message: "Apple Pay is not available on this device"
    )

    static let userCancelled = GatewayError(
        code: .userCancelled,
        message: "The user cancelled Apple Pay"
    )

    static func validation(_ message: String) -> GatewayError {
        GatewayError(code: .validationFailed, message: message)
    }

    static func network(_ cause: Error) -> GatewayError {
        if let urlErr = cause as? URLError, urlErr.code == .timedOut {
            return GatewayError(code: .timeout, message: "Request timed out", underlying: cause)
        }
        return GatewayError(code: .networkError, message: "Network request failed", underlying: cause)
    }

    /// Maps a non-2xx HTTP response into a GatewayError. Body is best-effort parsed as
    /// `{ "message": "...", "requestId": "..." }`; falls back to a generic status message.
    static func from(status: Int, body: Data) -> GatewayError {
        let payload = try? JSONDecoder().decode(WireError.self, from: body)
        let message = payload?.message ?? "HTTP \(status)"
        let requestId = payload?.requestId

        let code: Code
        switch status {
        case 401: code = .invalidApiKey
        case 402: code = .declined
        case 403: code = .sessionExpired
        case 422: code = .validationFailed
        case 429: code = .rateLimited
        default:  code = .internalError
        }

        return GatewayError(
            code: code,
            message: message,
            httpStatus: status,
            requestId: requestId
        )
    }
}

private struct WireError: Decodable {
    let message: String?
    let requestId: String?
}