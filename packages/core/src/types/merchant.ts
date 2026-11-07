import type { Environment } from "./environment";

export interface MerchantSession {
    sessionToken: string; //short-lived token used by sdk to call v1/payments
    appleMerchantId: string; //merchantId owned by gateway
    displayName: string;
    supportedNetworks: string[];
    merchantCapabilities: ApplePayCapability[];
    expiresAt: string;
    environment: Environment;
}

export type ApplePayCapability = | "supports3DS" | "supportsCredit" | "supportsDebit" | "supportsEMV";

export interface ApplePaySessionPayload {
    validationURL: string; //url forwarded from PKPaymentAuthorizationController
    domainName?: string;
    display?: string;
}

export interface ApplePayMerchantSession {
    merchantSession: string; //returned to apple to complete merchant validation
}