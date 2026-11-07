import Foundation
import PassKit
import GatewayPaySDK

// React Native's promise-resolve types live in <React/RCTBridgeModule.h> — an Objective-C
// header. Without modular headers or a bridging header, Swift can't see them. Declaring the
// same block signatures locally lets Swift compile; the Objective-C bridge in
// GatewayPayModule.m matches them at the ABI level via RCT_EXTERN_METHOD.
public typealias RCTPromiseResolveBlock = @convention(block) (Any?) -> Void
public typealias RCTPromiseRejectBlock = @convention(block) (String?, String?, NSError?) -> Void

@objc(GatewayPay)
class GatewayPayModule: NSObject {
    private var sdk: GatewayPaySDK?

    @objc static func requiresMainQueueSetup() -> Bool { true }

    @objc(configure:environment:baseUrl:headerPrefix:resolver:rejecter:)
    func configure(_ apiKey: String,
                   environment: String,
                   baseUrl: String,
                   headerPrefix: String?,
                   resolver resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
        let env: GatewayEnvironment = environment == "production" ? .production : .sandbox
        guard let url = URL(string: baseUrl) else {
            reject("invalid_base_url", "baseUrl is not a valid URL", nil)
            return
        }
        sdk = GatewayPaySDK(apiKey: apiKey, environment: env, baseURL: url, headerPrefix: headerPrefix)
        resolve(nil)
    }

    @objc(canMakePayments:rejecter:)
    func canMakePayments(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        resolve(PKPaymentAuthorizationController.canMakePayments())
    }

    @objc(authorize:resolver:rejecter:)
    func authorize(_ payload: NSDictionary,
                   resolver resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let sdk = sdk else {
            reject("not_configured", "Call configure() first", nil)
            return
        }
        do {
            let request = try PaymentRequest(dictionary: payload)
            sdk.authorize(request) { result in
                switch result {
                case .success(let response):
                    resolve(response.toDictionary())
                case .failure(let error):
                    reject(error.code.rawValue, error.localizedDescription, error as NSError)
                }
            }
        } catch {
            reject("invalid_request", error.localizedDescription, error as NSError)
        }
    }
}