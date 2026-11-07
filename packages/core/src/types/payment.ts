import type { Environment } from "./environment";

export interface Money {
    currency: string; //ISO-4217 currency code
    amount: number;
}

export interface LineItem {
    label: string;
    amount: number;
    type?: "final" | "pending";
}

export interface PaymentRequest {
    idempotencyKey?: string;  //UUID v4 gen by SDK if not supplied
    reference: string;
    total: Money;
    lineItems?: LineItem[];
    description?: string;
    countryCode: string;
    supportedCountries?: string[];
    supportedNetworks?: PaymentNetwork[];
    requiredBillingContactFields?: ContactField[];
    requiredShippingContactFields?: ContactField[];
    metadata?: Record<string, string>
}

export type PaymentNetwork = | "visa" | "mastercard" | "amex" | "discover" | "interac" | "jcb" | "unionpay" | "mada" | "elo"

export type ContactField = | "postalAddress" | "name" | "phoneNumber" | "emailAddress"

//PKPaymentAuthorizationController - Applepay token format
export interface ApplePayToken {
    paymentData: {
        version: "EC_v1" | "RSA_v1";
        data: string;
        signature: string;
        header: {
            ephemeralPublicKey?: string;
            wrappedKey?: string;
            publicKeyHash: string;
            transactionId: string;
        };
    };
    paymentMethod: {
        displayName: string;
        network: string;
        type: "debit" | "credit" | "prepaid" | "store"
    };
    transactionIdentifier: string;
}

export interface AuthorizeAppleParams {
    request: PaymentRequest;
    token: ApplePayToken;
    sessionToken: string; //token issued by /v1/session
}

export type PaymentStatus = | "AUTHORIZED" | "CAPTURED" | "FAILED" | "DECLINED" | "PENDING";

export interface PaymentResponse {
    id: string;
    status: PaymentStatus;
    reference: string;
    total: Money;
    authorizedAt: string;
    authorizationCode?: string;
    declineReason?: string;
    environment: Environment;
}