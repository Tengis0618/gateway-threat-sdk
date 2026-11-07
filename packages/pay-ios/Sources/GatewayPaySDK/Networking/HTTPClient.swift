import Foundation

final class HTTPClient {
    static let defaultHeaderPrefix = "X-Pay"

    private let apiKey: String
    private let baseURL: URL
    private let headerPrefix: String
    private let session: URLSession
    private let decoder = JSONDecoder.gateway
    private let encoder = JSONEncoder.gateway

    init(apiKey: String,
         baseURL: URL,
         headerPrefix: String = HTTPClient.defaultHeaderPrefix,
         session: URLSession = .shared) {
        self.apiKey = apiKey
        self.baseURL = baseURL
        self.headerPrefix = headerPrefix
        self.session = session
    }

    func openSession() async throws -> MerchantSession {
        try await post(path: Endpoints.session, body: EmptyBody())
    }

    func validateMerchant(validationURL: URL,
                          domain: String,
                          displayName: String) async throws -> ApplePayMerchantSession {
        try await post(
            path: Endpoints.validateMerchant,
            body: ValidateMerchantRequest(
                validationURL: validationURL.absoluteString,
                domainName: domain,
                displayName: displayName
            )
        )
    }

    func authorize(request: PaymentRequest,
                   token: ApplePayToken,
                   sessionToken: String) async throws -> PaymentResponse {
        try await post(
            path: Endpoints.payments,
            body: AuthorizeBody(
                request: request,
                token: token,
                sessionToken: sessionToken
            ),
            idempotencyKey: request.idempotencyKey ?? UUID().uuidString
        )
    }

    private func post<B: Encodable, R: Decodable>(
        path: String,
        body: B,
        idempotencyKey: String? = nil
    ) async throws -> R {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = "POST"
        req.setValue("Bearer \(apiKey)",        forHTTPHeaderField: "Authorization")
        req.setValue("application/json",        forHTTPHeaderField: "Content-Type")
        req.setValue("application/json",       forHTTPHeaderField: "Accept")
        req.setValue("GatewayPaySDK-iOS/2.0.0", forHTTPHeaderField: "X-Sdk-Version")
        req.setValue("@Gateway/pay-core",       forHTTPHeaderField: "\(headerPrefix)-Gateway")
        req.setValue("1.0.0",                   forHTTPHeaderField: "\(headerPrefix)-Version")
        req.setValue(idempotencyKey ?? UUID().uuidString,
                     forHTTPHeaderField: "Idempotency-Key")
        req.httpBody = try encoder.encode(body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw GatewayError.network(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw GatewayError.network(URLError(.badServerResponse))
        }
        guard (200..<300).contains(http.statusCode) else {
            logFailure(request: req, response: http, body: data)
            throw GatewayError.from(status: http.statusCode, body: data)
        }
        do {
            return try decoder.decode(R.self, from: data)
        } catch {
            Logger.net.error("decode failed \(req.url?.absoluteString ?? "-", privacy: .public): \(String(describing: error), privacy: .public)")
            throw GatewayError(
                code: .internalError,
                message: "Failed to decode response",
                httpStatus: http.statusCode,
                underlying: error
            )
        }
    }

    private func logFailure(request: URLRequest, response: HTTPURLResponse, body: Data) {

        var sent = request.allHTTPHeaderFields ?? [:]

        if let auth = sent["Authorization"] { sent["Authorization"] = Logger.redact(auth) }

        let received = response.allHeaderFields.map { "\($0.key): \($0.value)" }.sorted()

        let text = String(data: body.prefix(1000), encoding: .utf8) ?? "<\(body.count) bytes>"

        Logger.net.error("""

            HTTP \(response.statusCode, privacy: .public) \(request.httpMethod ?? "-", privacy: .public) \(request.url?.absoluteString ?? "-", privacy: .public)

            sent: \(String(describing: sent), privacy: .public)

            received: \(received.joined(separator: " | "), privacy: .public)

            body: \(text, privacy: .public)

            """)

    }
}