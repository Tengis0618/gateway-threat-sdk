import Foundation
import PassKit
#if os(macOS)
import AppKit
#endif

final class ApplePayCoordinator: NSObject, PKPaymentAuthorizationControllerDelegate {
    private let http: HTTPClient
    private var controller: PKPaymentAuthorizationController?
    private var pendingRequest: PaymentRequest?
    private var pendingSession: MerchantSession?
    private var completion: ((Result<PaymentResponse, GatewayError>) -> Void)?

    init(http: HTTPClient) {
        self.http = http
    }

    func present(apRequest: PKPaymentRequest,
                 request: PaymentRequest,
                 session: MerchantSession,
                 completion: @escaping (Result<PaymentResponse, GatewayError>) -> Void) async throws {
        self.pendingRequest = request
        self.pendingSession = session
        self.completion = completion

        let c = PKPaymentAuthorizationController(paymentRequest: apRequest)
        c.delegate = self
        self.controller = c

        let presented = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            c.present { ok in cont.resume(returning: ok) }
        }
        if !presented {
            self.completion = nil
            throw GatewayError.applePayUnavailable
        }
    }

    // MARK: - PKPaymentAuthorizationControllerDelegate

    func paymentAuthorizationController(
        _ controller: PKPaymentAuthorizationController,
        didAuthorizePayment payment: PKPayment,
        handler completion: @escaping (PKPaymentAuthorizationResult) -> Void
    ) {
        guard let request = pendingRequest, let session = pendingSession else {
            completion(PKPaymentAuthorizationResult(status: .failure, errors: nil))
            return
        }
        let token = ApplePayToken(payment: payment)
        let userCompletion = self.completion

        Task {
            do {
                let response = try await http.authorize(
                    request: request,
                    token: token,
                    sessionToken: session.sessionToken
                )
                await MainActor.run {
                    completion(PKPaymentAuthorizationResult(status: .success, errors: nil))
                    userCompletion?(.success(response))
                    self.completion = nil
                }
            } catch let err as GatewayError {
                await MainActor.run {
                    completion(PKPaymentAuthorizationResult(status: .failure, errors: nil))
                    userCompletion?(.failure(err))
                    self.completion = nil
                }
            } catch {
                await MainActor.run {
                    completion(PKPaymentAuthorizationResult(status: .failure, errors: nil))
                    userCompletion?(.failure(.network(error)))
                    self.completion = nil
                }
            }
        }
    }

    func paymentAuthorizationControllerWillAuthorizePayment(
        _ controller: PKPaymentAuthorizationController
    ) {
        // no-op; hook exists for merchants who want to update summary items before authorisation
    }

    func paymentAuthorizationControllerDidFinish(
        _ controller: PKPaymentAuthorizationController
    ) {
        controller.dismiss { [weak self] in
            // If completion was never invoked by didAuthorizePayment, the user cancelled the sheet.
            if let cb = self?.completion {
                cb(.failure(.userCancelled))
            }
            self?.cleanup()
        }
    }

    #if os(macOS)
    func presentationWindow(for controller: PKPaymentAuthorizationController) -> 
    NSWindow? {
        NSApplication.shared.keyWindow
    }
    #endif

    private func cleanup() {
        pendingRequest = nil
        pendingSession = nil
        completion = nil
        controller = nil
    }
}