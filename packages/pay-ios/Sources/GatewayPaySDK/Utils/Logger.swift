import Foundation
import os

enum Logger {
    private static let subsystem = "com.yourgateway.pay"

    static let net   = os.Logger(subsystem: subsystem, category: "network")
    static let apple = os.Logger(subsystem: subsystem, category: "applepay")
    static let sdk   = os.Logger(subsystem: subsystem, category: "sdk")

    /// Redacts long secret-shaped strings (PANs, tokens, base64 blobs) for logging.
    /// Keeps four characters at each end so operators can correlate requests without leaking material.
    static func redact(_ value: String) -> String {
        guard value.count > 8 else { return "…" }
        return "\(value.prefix(4))…\(value.suffix(4))"
    }
}