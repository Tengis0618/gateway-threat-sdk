import { GatewayPay, loadApplePaySDK } from "@gateway/pay-web";

// ─── DIAGNOSTIC BLOCK — remove after verifying ─────────────────────────────
const originalFetch = window.fetch.bind(window);
window.fetch = async function loggingFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<Response> {
    const url =
        typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
    console.log("[fetch →]", url, {
        method: init?.method ?? "GET",
    });
    try {
        const res = await originalFetch(input, init);
        console.log("[fetch ←]", url, res.status, res.statusText);
        return res;
    } catch (err) {
        console.error("[fetch ✗]", url, err);
        throw err;
    }
};
// ────────────────────────────────────────────────────────────────────────────

const baseUrl = import.meta.env.VITE_GATEWAY_BASE_URL;
if (!baseUrl) throw new Error("Set VITE_GATEWAY_BASE_URL in apps/example-web/.env.local");

const headerPrefix = import.meta.env.VITE_GATEWAY_HEADER_PREFIX;

const pay = new GatewayPay({
    apiKey: import.meta.env.VITE_GATEWAY_API_KEY ?? "pk_sandbox_demo",
    environment: import.meta.env.VITE_GATEWAY_ENVIRONMENT === "production" ? "production" : "sandbox",
    baseUrl, // a relative path is routed through the Vite proxy
    ...(headerPrefix && { headerPrefix }),
});

const container = document.querySelector<HTMLDivElement>("#apple-pay-container")!;
const out = document.querySelector<HTMLPreElement>("#out")!;

// Load Apple's official <apple-pay-button> custom element.
await loadApplePaySDK();

if (!pay.canMakePayments()) {
    out.textContent =
        "Apple Pay isn't available in this browser. Open in Safari (macOS/iOS) or Chrome on iOS.";
} else {
    // Create the official Apple Pay button element directly — no createApplePayButton wrapper.
    const btn = document.createElement("apple-pay-button");
    btn.setAttribute("buttonstyle", "black");
    btn.setAttribute("type", "buy");
    btn.setAttribute("locale", "en-US");

    btn.addEventListener("click", async () => {
        out.textContent = "Contacting gateway…";
        try {
            const response = await pay.authorize({
                reference: `DEMO-${Date.now()}`,
                total: { currency: "MNT", amount: 1000 },
                countryCode: "MN",
                supportedNetworks: ["visa", "mastercard", "amex"],
                description: "Demo",
            });
            out.textContent = JSON.stringify(response, null, 2);
        } catch (err) {
            console.error("[authorize threw]", err);
            out.textContent =
                err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        }
    });

    container.appendChild(btn);
    out.textContent = "Ready. Tap the button to pay.";
}