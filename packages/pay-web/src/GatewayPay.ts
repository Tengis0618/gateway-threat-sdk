import { 
    HttpClient,
    paymentRequestSchema,
    validate,
    GatewayError,
    type Environment,
    type PaymentRequest,
    type PaymentResponse,
    type MerchantSession,
    type ApplePayMerchantSession,
    ErrorCode
} from "@gateway/pay-core";

import { canMakeApplePayments } from "./applepay/canMakePayments";
import { buildApplePayRequest } from "./applepay/request";

export interface GatewayPayOptions {
    apiKey: string;
    environment: Environment;
    domainName?: string;
    baseUrl: string;
    headerPrefix?: string;
}

export class GatewayPay {
    private readonly http: HttpClient;
    private readonly domainName: string;

    constructor(private readonly opts: GatewayPayOptions) {
        this.http = new HttpClient({
            apiKey: opts.apiKey,
            environment: opts.environment,
            baseUrl: opts.baseUrl,
            ...(opts.headerPrefix !== undefined && { headerPrefix: opts.headerPrefix }),
        });
        this.domainName = opts.domainName ?? window.location.hostname;
    }

    //return true if apple pay available in this browser
    canMakePayments(): boolean {
        return canMakeApplePayments();
    }

    //present apple pay sheet and resolves with the gateway's authorisation 
    //once the merchant validation -> payment authorisation -> backend
    //processing flow complete
    async authorize(input: PaymentRequest): Promise<PaymentResponse> {
        const request = validate(paymentRequestSchema, input) as PaymentRequest;

        if (!this.canMakePayments()) {
            throw new GatewayError(ErrorCode.ApplePayUnavailable, "Apple Pay is not available in this browser");
        }

        //open short gateway session
        const session = await this.http.request<MerchantSession> ({
            method: "POST", path: "/v1/session"
        });
        console.log("[session response]", JSON.stringify(session, null, 2))

        const applePayRequest = buildApplePayRequest(request, session);
        const apSession = new window.ApplePaySession(14, applePayRequest);

        return new Promise<PaymentResponse>((resolve, reject) => {
            //apple validate merchant -> proxy to backend
            apSession.onvalidatemerchant = (event: ApplePayJS.ApplePayValidateMerchantEvent) => {
            (async () => {
                try {
                    const validation = await this.http.request<ApplePayMerchantSession>({
                        method: "POST",
                        path: "/v1/validate-merchant",
                        body: {
                            validationURL: event.validationURL,
                            domainName: this.domainName,
                            displayName: session.displayName
                        }
                    });
                    apSession.completeMerchantValidation(JSON.parse(validation.merchantSession));
                } catch (err) {
                    apSession.abort();
                    reject(err);
                }
            })();
            }

            apSession.onpaymentauthorized = (event: ApplePayJS.ApplePayPaymentAuthorizedEvent) => {
            (async () => {
                try {
                const response =
                    await this.http.request<PaymentResponse>({
                    method: "POST",
                    path: "/v1/payments",
                    body: {
                        request,
                        token: event.payment.token,
                        sessionToken: session.sessionToken
                    },
                    ...(request.idempotencyKey && {
                        idempotencyKey: request.idempotencyKey
                    })
                    });

                apSession.completePayment({
                    status: window.ApplePaySession.STATUS_SUCCESS
                });

                resolve(response);
                } catch (err) {
                apSession.completePayment({
                    status: window.ApplePaySession.STATUS_FAILURE
                });

                reject(err);
                }
            })();
            };

            apSession.oncancel = () => {
                reject(new GatewayError(ErrorCode.UserCancelled, "User cancelled"));
            };

            apSession.begin();
        })
    }

}