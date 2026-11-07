import { describe, it, expect } from "vitest";
import { moneySchema, lineItemsSchema, paymentRequestSchema } from "../schemas";

describe("moneySchema", () => {
    it("accepts a valid ISO-4217 currency and non-negative integer amount", () => {
        expect(moneySchema.safeParse({ currency: "USD", amount: 4999 }).success).toBe(true);
    });

    it("rejects currencies that are not exactly 3 characters", () => {
        expect(moneySchema.safeParse({ currency: "US", amount: 100 }).success).toBe(false);
        expect(moneySchema.safeParse({ currency: "USDD", amount: 100 }).success).toBe(false);
    });

    it("rejects negative amounts", () => {
        expect(moneySchema.safeParse({ currency: "USD", amount: -1 }).success).toBe(false);
    });

    it("rejects non-integer amounts (money is minor units, no fractions)", () => {
        expect(moneySchema.safeParse({ currency: "USD", amount: 9.99 }).success).toBe(false);
    });
});

describe("lineItemsSchema", () => {
    it("accepts a minimal line item without type", () => {
        expect(lineItemsSchema.safeParse({ label: "T-shirt", amount: 1000 }).success).toBe(true);
    });

    it("accepts both `final` and `pending` types", () => {
        expect(lineItemsSchema.safeParse({ label: "X", amount: 1, type: "final" }).success).toBe(true);
        expect(lineItemsSchema.safeParse({ label: "X", amount: 1, type: "pending" }).success).toBe(true);
    });

    it("rejects labels longer than 120 characters", () => {
        expect(lineItemsSchema.safeParse({ label: "x".repeat(121), amount: 1 }).success).toBe(false);
    });

    it("rejects empty labels", () => {
        expect(lineItemsSchema.safeParse({ label: "", amount: 1 }).success).toBe(false);
    });

    it("rejects unknown type values", () => {
        expect(
            lineItemsSchema.safeParse({ label: "X", amount: 1, type: "authorized" }).success,
        ).toBe(false);
    });
});

describe("paymentRequestSchema", () => {
    const minimal = {
        reference: "ORDER-1",
        total: { currency: "USD", amount: 4999 },
        countryCode: "US",
    };

    it("accepts a minimal request with just reference, total, and countryCode", () => {
        expect(paymentRequestSchema.safeParse(minimal).success).toBe(true);
    });

    it("rejects a request missing the reference", () => {
        const { reference: _reference, ...noRef } = minimal;
        expect(paymentRequestSchema.safeParse(noRef).success).toBe(false);
    });

    it("rejects references longer than 64 characters", () => {
        expect(
            paymentRequestSchema.safeParse({ ...minimal, reference: "x".repeat(65) }).success,
        ).toBe(false);
    });

    it("rejects a countryCode that is not exactly 2 characters", () => {
        expect(
            paymentRequestSchema.safeParse({ ...minimal, countryCode: "USA" }).success,
        ).toBe(false);
    });

    it("rejects an idempotencyKey that is not a UUID", () => {
        expect(
            paymentRequestSchema.safeParse({ ...minimal, idempotencyKey: "not-a-uuid" }).success,
        ).toBe(false);
    });

    it("accepts a UUID idempotencyKey", () => {
        expect(
            paymentRequestSchema.safeParse({
                ...minimal,
                idempotencyKey: "6f8e0b6a-2e57-4d5f-8a5d-6c9b6b1a2f3e",
            }).success,
        ).toBe(true);
    });

    it("rejects descriptions longer than 280 characters", () => {
        expect(
            paymentRequestSchema.safeParse({ ...minimal, description: "x".repeat(281) }).success,
        ).toBe(false);
    });

    // REGRESSION: earlier revisions of this schema used the key `supportedCountried`,
    // which caused values under `supportedCountries` to be silently dropped.
    it("preserves `supportedCountries` under its correctly-spelled key", () => {
        const parsed = paymentRequestSchema.safeParse({
            ...minimal,
            supportedCountries: ["US", "CA"],
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.supportedCountries).toEqual(["US", "CA"]);
        }
    });

    it("rejects supportedCountries entries that are not 2 characters", () => {
        expect(
            paymentRequestSchema.safeParse({
                ...minimal,
                supportedCountries: ["USA"],
            }).success,
        ).toBe(false);
    });

    // REGRESSION: earlier revisions used the key `metada`.
    it("preserves `metadata` under its correctly-spelled key", () => {
        const parsed = paymentRequestSchema.safeParse({
            ...minimal,
            metadata: { orderId: "42", channel: "web" },
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.metadata).toEqual({ orderId: "42", channel: "web" });
        }
    });

    it("accepts every documented card network", () => {
        expect(
            paymentRequestSchema.safeParse({
                ...minimal,
                supportedNetworks: [
                    "visa",
                    "mastercard",
                    "amex",
                    "discover",
                    "interac",
                    "jcb",
                    "unionpay",
                    "mada",
                    "elo",
                ],
            }).success,
        ).toBe(true);
    });

    it("rejects unknown supportedNetworks values", () => {
        expect(
            paymentRequestSchema.safeParse({
                ...minimal,
                supportedNetworks: ["googlepay"],
            }).success,
        ).toBe(false);
    });

    it("emits path-scoped error messages for failures", () => {
        const parsed = paymentRequestSchema.safeParse({
            ...minimal,
            total: { currency: "US", amount: -1 },
        });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
            const paths = parsed.error.errors.map((e) => e.path.join("."));
            expect(paths).toContain("total.currency");
            expect(paths).toContain("total.amount");
        }
    });
});