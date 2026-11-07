import type { ApplePayCapabilityStatus } from "../types/applepay";
export type {ApplePayCapabilityStatus, ApplePayCapabilities} from "../types/applepay";

export function canMakeApplePayments(): boolean {
    if (typeof window === "undefined") return false;
    const ap = (window as unknown as { ApplePaySession?: typeof ApplePaySession}).ApplePaySession;
    if (!ap) return false;
    try {
        return ap.canMakePayments();
    } catch ( err ) {
        return false;
    }
}

export async function getApplePayCapabilities(

    merchantIdentifier: string,

): Promise<ApplePayCapabilityStatus> {

    if (typeof window === "undefined") return "applePayUnsupported";

    const ap = (window as unknown as { ApplePaySession?: typeof ApplePaySession }).ApplePaySession;

    if (!ap) return "applePayUnsupported";

    // Newer path — Safari 17+.

    if (typeof ap.applePayCapabilities === "function") {

        try {

            const caps = await ap.applePayCapabilities(merchantIdentifier);

            return caps.paymentCredentialStatus;

        } catch {

            return "applePayUnsupported";

        }

    }

    // Older Safari fallback — collapse the boolean into the richer enum.

    try {

        return ap.canMakePayments() ? "paymentCredentialsAvailable" : "applePayUnsupported";

    } catch {

        return "applePayUnsupported";

    }

}

export function shouldShowApplePayButton(status: ApplePayCapabilityStatus): boolean {

    return status !== "applePayUnsupported";

}