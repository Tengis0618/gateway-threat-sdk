import type { PaymentRequest, PaymentResponse } from "@gateway/pay-core";
import type { GatewayPay } from "../GatewayPay";
import { getApplePayCapabilities, shouldShowApplePayButton } from "../applepay/canMakePayments";

export type ApplePayButtonStyle = "black" | "white" | "white-outline";

export type ApplePayButtonType =
    | "add-money"
    | "book"
    | "buy"
    | "check-out"
    | "continue"
    | "contribute"
    | "donate"
    | "order"
    | "pay"
    | "plain"
    | "reload"
    | "rent"
    | "set-up"
    | "subscribe"
    | "support"
    | "tip"
    | "top-up";

export interface ApplePayButtonOptions {

    sdk: GatewayPay;
    request: PaymentRequest | (() => PaymentRequest);
    merchantIdentifier: string;
    style?: ApplePayButtonStyle;
    type?: ApplePayButtonType;
    locale?: string;

    onSuccess?: (response: PaymentResponse) => void;
    onError?: (error: unknown) => void;
    onCancel?: () => void;

}

const APPLE_SDK_URL = "https://applepay.cdn-apple.com/jsapi/v1/apple-pay-sdk.js";

/**

 * Injects Apple's official Apple Pay JS SDK script into the document, which registers
 * the <apple-pay-button> custom element. Idempotent — safe to call multiple times.
 *

 * Note: this script is served from Apple's CDN and is required for the official button.
 * Merchants who prefer to self-host the button styling can skip this and use CSS
 * -webkit-appearance: -apple-pay-button instead.

 */

export function loadApplePaySDK(): Promise<void> {

    if (typeof document === "undefined") return Promise.resolve();

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${APPLE_SDK_URL}"]`);

    if (existing) {

        return existing.dataset.loaded === "true"

            ? Promise.resolve()

            : new Promise((resolve, reject) => {

                  existing.addEventListener("load", () => resolve());

                  existing.addEventListener("error", () => reject(new Error("Apple Pay SDK failed to load")));

              });

    }

    return new Promise((resolve, reject) => {

        const script = document.createElement("script");

        script.src = APPLE_SDK_URL;

        script.crossOrigin = "anonymous";

        script.async = true;

        script.addEventListener("load", () => {

            script.dataset.loaded = "true";

            resolve();

        });

        script.addEventListener("error", () => reject(new Error("Apple Pay SDK failed to load")));

        document.head.appendChild(script);

    });

}

/**

 * Creates an <apple-pay-button> element wired to the SDK's authorize() flow.

 *

 * Returns null if Apple Pay isn't available in this browser — the caller should render

 * a fallback UI in that case (card form, PayPal, etc.). If Apple Pay IS available, the

 * button is returned ready to append to the DOM; clicking it triggers sdk.authorize()

 * and dispatches success/error/cancel callbacks.

 *

 * Call loadApplePaySDK() first, or make sure the Apple Pay JS script is included in your

 * page. Without it, the custom element renders as an unstyled fallback.

 *

 * @example

 * await loadApplePaySDK();

 * const btn = await createApplePayButton({

 *     sdk: pay,

 *     request: { reference: "ORDER-1", total: {...}, countryCode: "US" },

 *     merchantIdentifier: "merchant.com.example.pay",

 *     style: "black",

 *     type: "buy",

 *     onSuccess: (r) => console.log("paid", r.id),

 *     onError: (e) => console.error(e),

 * });

 * if (btn) container.appendChild(btn);

 * else container.textContent = "Apple Pay unavailable — please use another method.";

 */

export async function createApplePayButton(

    opts: ApplePayButtonOptions,

): Promise<HTMLElement | null> {

    const status = await getApplePayCapabilities(opts.merchantIdentifier);

    if (!shouldShowApplePayButton(status)) return null;

    const button = document.createElement("apple-pay-button");

    button.setAttribute("buttonstyle", opts.style ?? "black");

    button.setAttribute("type", opts.type ?? "buy");

    button.setAttribute("locale", opts.locale ?? "en-US");

    button.addEventListener("click", async () => {

        const request =

            typeof opts.request === "function" ? opts.request() : opts.request;

        try {

            const response = await opts.sdk.authorize(request);

            opts.onSuccess?.(response);

        } catch (err) {

            if (

                typeof err === "object" &&

                err !== null &&

                "code" in err &&

                (err as { code: string }).code === "USER_CANCELLED"

            ) {

                opts.onCancel?.();

            } else {

                opts.onError?.(err);

            }

        }

    });

    return button;

}