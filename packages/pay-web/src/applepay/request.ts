import { type MerchantSession, type PaymentRequest, type ContactField, GatewayError, ErrorCode } from "@gateway/pay-core";

const CONTACT_FIELD_MAP: Record<ContactField, ApplePayJS.ApplePayContactField> = {
    postalAddress: "postalAddress",
    name: "name",
    phoneNumber: "phone",
    emailAddress: "email",
}

const toApplePayContactFields = (
    fields: ContactField[] | undefined,
): ApplePayJS.ApplePayContactField[] | undefined => fields?.map((f) => CONTACT_FIELD_MAP[f]);

const APPLE_PAY_NETWORK_MAP: Record<string, string> = {
    visa: "visa",
    mastercard: "masterCard",
    amex: "amex",
    discover: "discover",
    jsc: "JCB",
    unionpay: "chinaUnionPay",
    mada: "mada",
    elo: "elo",
    masterCard: "masterCard",
    JCB: "JCB",
    chinaunionPay: "chinaUnionPay"
}

const toApplePayNetwork = (network: string): string => APPLE_PAY_NETWORK_MAP[network] ?? network;

export function buildApplePayRequest (req: PaymentRequest, session: MerchantSession): ApplePayJS.ApplePayPaymentRequest {
    //const rawNetworks = req.supportedNetworks ?? session.supportedNetworks;
    const rawNetworks = (req.supportedNetworks && session.supportedNetworks.length > 0) ? req.supportedNetworks : session.supportedNetworks;
    const capabilities = session.merchantCapabilities?.length ? session.merchantCapabilities : (["supports3DS"] as ApplePayJS.ApplePayMerchantCapability[])


    if (!rawNetworks || rawNetworks.length === 0) {
        throw new GatewayError(ErrorCode.ApplePayUnavailable, "No supported networks")
    }

    return {
        countryCode: req.countryCode,
        currencyCode: req.total.currency,
        merchantCapabilities: capabilities,
        supportedNetworks: rawNetworks.map(toApplePayNetwork),
        total: {
            label: session.displayName,
            amount: (req.total.amount / 100).toFixed(2),
            type: "final",
        },
        lineItems: req.lineItems?.map((li) => ({
            label: li.label,
            amount: (li.amount / 100).toFixed(2),
            type: li.type ?? "final",
        })),
        requiredBillingContactFields: toApplePayContactFields(req.requiredBillingContactFields),
        requiredShippingContactFields: toApplePayContactFields(req.requiredShippingContactFields)
    }
}