// Mock react-native BEFORE importing the SDK — SDK reads Platform.OS and NativeModules at import time.
jest.mock("react-native", () => ({
    Platform: { OS: "ios" },
    NativeModules: {
        GatewayPay: {
            configure: jest.fn().mockResolvedValue(undefined),
            canMakePayments: jest.fn().mockResolvedValue(true),
            authorize: jest.fn(),
        },
    },
    Linking: { openURL: jest.fn().mockResolvedValue(undefined) },
}));

import { NativeModules, Platform, Linking } from "react-native";
import { GatewayPay, ErrorCode } from "../index";

const minimalRequest = {
    reference: "ORDER-1",
    total: { currency: "USD", amount: 999 },
    countryCode: "US",
};

const validResponse = {
    id: "pmt_1",
    status: "AUTHORIZED" as const,
    reference: "ORDER-1",
    total: { currency: "USD", amount: 999 },
    authorizedAt: "2026-08-07T00:00:00Z",
    environment: "sandbox" as const,
};

const options = {
    apiKey: "pk",
    environment: "sandbox" as const,
    baseUrl: "https://gateway.example.com",
    webCheckoutUrl: "https://example.com/checkout",
};

// Convenience — the mocked native module, with jest.Mock types visible.
const native = NativeModules.GatewayPay as {
    configure: jest.Mock;
    canMakePayments: jest.Mock;
    authorize: jest.Mock;
};

describe("GatewayPay (react-native)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (Platform as { OS: string }).OS = "ios";
        native.canMakePayments.mockResolvedValue(true);
        native.configure.mockResolvedValue(undefined);
    });

    describe("iOS", () => {
        it("calls native.configure on construction", () => {
            new GatewayPay(options);
            expect(native.configure).toHaveBeenCalledWith(
                "pk",
                "sandbox",
                "https://gateway.example.com",
                null,
            );
        });

        it("passes a configured headerPrefix to native.configure", () => {
            new GatewayPay({ ...options, headerPrefix: "X-Acme" });
            expect(native.configure).toHaveBeenCalledWith(
                "pk",
                "sandbox",
                "https://gateway.example.com",
                "X-Acme",
            );
        });

        it("delegates canMakePayments to the native module", async () => {
            const sdk = new GatewayPay(options);
            const result = await sdk.canMakePayments();
            expect(native.canMakePayments).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it("returns false when the native module says Apple Pay is unavailable", async () => {
            native.canMakePayments.mockResolvedValue(false);
            const sdk = new GatewayPay(options);
            await expect(sdk.canMakePayments()).resolves.toBe(false);
        });

        it("delegates authorize to native after validating the request", async () => {
            native.authorize.mockResolvedValue(validResponse);
            const sdk = new GatewayPay(options);

            const result = await sdk.authorize(minimalRequest);

            expect(native.authorize).toHaveBeenCalledWith(
                expect.objectContaining({
                    reference: "ORDER-1",
                    total: { currency: "USD", amount: 999 },
                    countryCode: "US",
                }),
            );
            expect(result).toEqual(validResponse);
        });

        it("throws a validation error before calling native for invalid input", async () => {
            const sdk = new GatewayPay(options);

            await expect(
                sdk.authorize({ ...minimalRequest, countryCode: "USA" }),
            ).rejects.toThrow();
            expect(native.authorize).not.toHaveBeenCalled();
        });

        it("surfaces native.authorize failures unchanged", async () => {
            native.authorize.mockRejectedValue(new Error("declined"));
            const sdk = new GatewayPay(options);

            await expect(sdk.authorize(minimalRequest)).rejects.toThrow("declined");
        });
    });

    describe("Android fallback", () => {
        beforeEach(() => {
            (Platform as { OS: string }).OS = "android";
        });

        it("does NOT call native.configure on construction", () => {
            new GatewayPay(options);
            expect(native.configure).not.toHaveBeenCalled();
        });

        it("reports canMakePayments = true when a webCheckoutUrl is configured", async () => {
            const sdk = new GatewayPay(options);
            await expect(sdk.canMakePayments()).resolves.toBe(true);
        });

        it("reports canMakePayments = false when webCheckoutUrl is empty", async () => {
            const sdk = new GatewayPay({ ...options, webCheckoutUrl: "" });
            await expect(sdk.canMakePayments()).resolves.toBe(false);
        });

        it("opens the web checkout URL and throws ApplePayUnavailable when authorising", async () => {
            const sdk = new GatewayPay(options);

            await expect(sdk.authorize(minimalRequest)).rejects.toMatchObject({
                code: ErrorCode.ApplePayUnavailable,
            });
            expect(Linking.openURL).toHaveBeenCalledWith(options.webCheckoutUrl);
            expect(native.authorize).not.toHaveBeenCalled();
        });

        it("throws ApplePayUnavailable without opening a URL when webCheckoutUrl is empty", async () => {
            const sdk = new GatewayPay({ ...options, webCheckoutUrl: "" });

            await expect(sdk.authorize(minimalRequest)).rejects.toMatchObject({
                code: ErrorCode.ApplePayUnavailable,
            });
            expect(Linking.openURL).not.toHaveBeenCalled();
        });

        it("validates before running the fallback (no URL open on invalid input)", async () => {
            const sdk = new GatewayPay(options);

            await expect(
                sdk.authorize({ ...minimalRequest, countryCode: "USA" }),
            ).rejects.toThrow();
            expect(Linking.openURL).not.toHaveBeenCalled();
        });
    });
});