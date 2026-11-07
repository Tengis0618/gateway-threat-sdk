/// <reference types="applepayjs" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode, GatewayError } from "@gateway/pay-core";

// Hoist the canMakePayments mock so both the mock factory and the tests
// reference the same vi.fn() instance.
const { canMakePaymentsFn } = vi.hoisted(() => ({ canMakePaymentsFn: vi.fn() }));

vi.mock("../applepay/canMakePayments", () => ({
    canMakeApplePayments: () => canMakePaymentsFn(),
}));

// Import after the mock is registered.
import { GatewayPay } from "../GatewayPay";

/**
 * Test double for `ApplePaySession`. Captures the callbacks the SDK assigns and
 * exposes trigger* helpers so tests can drive the flow deterministically.
 */
class MockApplePaySession {
    static readonly STATUS_SUCCESS = 0;
    static readonly STATUS_FAILURE = 1;

    onvalidatemerchant?: (event: { validationURL: string }) => void;
    onpaymentauthorized?: (event: { payment: { token: unknown } }) => void;
    oncancel?: () => void;

    begin = vi.fn();
    abort = vi.fn();
    completeMerchantValidation = vi.fn();
    completePayment = vi.fn();

    constructor(_version: number, _request: unknown) {}

    triggerValidateMerchant(validationURL = "https://apple.example/validate") {
        this.onvalidatemerchant?.({ validationURL });
    }

    triggerPaymentAuthorized(token: unknown = { paymentData: "opaque" }) {
        this.onpaymentauthorized?.({ payment: { token } });
    }

    triggerCancel() {
        this.oncancel?.();
    }
}

let currentSession: MockApplePaySession | undefined;

function installMockApplePaySession() {
    currentSession = undefined;
    const proxy = new Proxy(MockApplePaySession, {
        construct(target, args: [number, unknown]) {
            const inst = new (target as typeof MockApplePaySession)(...args);
            currentSession = inst;
            return inst;
        },
    });
    (window as unknown as { ApplePaySession: unknown }).ApplePaySession = proxy;
}

const minimalRequest = {
    reference: "ORDER-1",
    total: { currency: "USD", amount: 4999 },
    countryCode: "US",
};

const sessionBody = {
    sessionToken: "st_1",
    appleMerchantId: "merchant.com.yourgateway.payments",
    displayName: "Gateway",
    supportedNetworks: ["visa", "mastercard"],
    merchantCapabilities: ["supports3DS"],
    expiresAt: "2026-08-07T00:15:00Z",
    environment: "sandbox",
};

const merchantValidation = { merchantSession: JSON.stringify({ signed: "blob" }) };

const paymentResponse = {
    id: "pmt_1",
    status: "AUTHORIZED",
    reference: "ORDER-1",
    total: { currency: "USD", amount: 4999 },
    authorizedAt: "2026-08-07T00:00:01Z",
    environment: "sandbox",
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

describe("GatewayPay (web)", () => {
    let originalFetch: typeof fetch;

    beforeEach(() => {
        canMakePaymentsFn.mockReturnValue(true);
        installMockApplePaySession();
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        delete (window as unknown as { ApplePaySession?: unknown }).ApplePaySession;
        vi.restoreAllMocks();
    });

    it("throws ApplePayUnavailable when canMakePayments returns false", async () => {
        canMakePaymentsFn.mockReturnValue(false);
        const sdk = new GatewayPay({ apiKey: "k", environment: "sandbox", baseUrl: "https://gateway.example.com" });

        await expect(sdk.authorize(minimalRequest)).rejects.toMatchObject({
            code: ErrorCode.ApplePayUnavailable,
        });
    });

    it("throws a GatewayError for invalid input before any network call", async () => {
        const fetchImpl = vi.fn();
        global.fetch = fetchImpl as unknown as typeof fetch;

        const sdk = new GatewayPay({ apiKey: "k", environment: "sandbox", baseUrl: "https://gateway.example.com" });

        await expect(
            sdk.authorize({ ...minimalRequest, countryCode: "USA" }),
        ).rejects.toBeInstanceOf(GatewayError);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("runs the full session → validate-merchant → payments happy path", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(sessionBody))
            .mockResolvedValueOnce(jsonResponse(merchantValidation))
            .mockResolvedValueOnce(jsonResponse(paymentResponse));
        global.fetch = fetchImpl as unknown as typeof fetch;

        const sdk = new GatewayPay({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: "https://gateway.example.com",
            domainName: "shop.example",
        });

        const promise = sdk.authorize(minimalRequest);

        // Wait for the SDK to open the merchant session and install ApplePaySession callbacks.
        await vi.waitFor(() => {
            expect(currentSession).toBeDefined();
            expect(currentSession!.begin).toHaveBeenCalled();
        });

        // Drive the ApplePaySession callbacks.
        currentSession!.triggerValidateMerchant();
        await vi.waitFor(() =>
            expect(currentSession!.completeMerchantValidation).toHaveBeenCalledWith({
                signed: "blob",
            }),
        );

        currentSession!.triggerPaymentAuthorized();
        await vi.waitFor(() =>
            expect(currentSession!.completePayment).toHaveBeenCalledWith({
                status: MockApplePaySession.STATUS_SUCCESS,
            }),
        );

        await expect(promise).resolves.toEqual(paymentResponse);
        expect(fetchImpl).toHaveBeenCalledTimes(3);

        // The three expected endpoints, in order.
        const paths = fetchImpl.mock.calls.map((c) => new URL(c[0] as string).pathname);
        expect(paths).toEqual(["/v1/session", "/v1/validate-merchant", "/v1/payments"]);
    });

    it("rejects with UserCancelled when the sheet is dismissed", async () => {
        const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(sessionBody));
        global.fetch = fetchImpl as unknown as typeof fetch;

        const sdk = new GatewayPay({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: "https://gateway.example.com",
            domainName: "shop.example",
        });

        const promise = sdk.authorize(minimalRequest);
        await vi.waitFor(() => expect(currentSession).toBeDefined());

        currentSession!.triggerCancel();

        await expect(promise).rejects.toMatchObject({ code: ErrorCode.UserCancelled });
    });

    it("aborts the session when merchant validation fails", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(sessionBody))
            .mockResolvedValueOnce(jsonResponse({ message: "invalid domain" }, 422));
        global.fetch = fetchImpl as unknown as typeof fetch;

        const sdk = new GatewayPay({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: "https://gateway.example.com",
            domainName: "shop.example",
        });

        const promise = sdk.authorize(minimalRequest);
        await vi.waitFor(() => expect(currentSession).toBeDefined());

        currentSession!.triggerValidateMerchant();

        await expect(promise).rejects.toMatchObject({ code: ErrorCode.ValidationFailed });
        expect(currentSession!.abort).toHaveBeenCalled();
    });

    it("completes the payment with FAILURE when authorisation errors on the backend", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(sessionBody))
            .mockResolvedValueOnce(jsonResponse(merchantValidation))
            .mockResolvedValueOnce(jsonResponse({ message: "declined" }, 402));
        global.fetch = fetchImpl as unknown as typeof fetch;

        const sdk = new GatewayPay({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: "https://gateway.example.com",
            domainName: "shop.example",
        });

        const promise = sdk.authorize(minimalRequest);
        await vi.waitFor(() => expect(currentSession).toBeDefined());

        currentSession!.triggerValidateMerchant();
        await vi.waitFor(() => expect(currentSession!.completeMerchantValidation).toHaveBeenCalled());

        currentSession!.triggerPaymentAuthorized();

        await expect(promise).rejects.toBeInstanceOf(GatewayError);
        expect(currentSession!.completePayment).toHaveBeenCalledWith({
            status: MockApplePaySession.STATUS_FAILURE,
        });
    });
});