import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retryWithBackOff } from "../retry";

describe("retryWithBackOff", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns immediately on first success", async () => {
        const fn = vi.fn().mockResolvedValue("ok");
        const result = await retryWithBackOff(fn, 3, () => true);
        expect(result).toBe("ok");
        expect(fn).toHaveBeenCalledOnce();
    });

    it("retries retryable errors and eventually succeeds", async () => {
        const fn = vi
            .fn()
            .mockRejectedValueOnce(new Error("net"))
            .mockRejectedValueOnce(new Error("net"))
            .mockResolvedValueOnce("done");

        const promise = retryWithBackOff(fn, 3, () => true);
        await vi.runAllTimersAsync();

        await expect(promise).resolves.toBe("done");
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it("throws the last error after exhausting maxAttempts", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("net"));
        const promise = retryWithBackOff(fn, 2, () => true);
        promise.catch(() => {})
        await vi.runAllTimersAsync();

        await expect(promise).rejects.toThrow("net");
        // Initial attempt + 2 retries = 3 total invocations.
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it("does not retry when isRetryable returns false", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("validation"));
        const isRetryable = vi.fn().mockReturnValue(false);

        const promise = retryWithBackOff(fn, 5, isRetryable);
        promise.catch(() => {})
        await vi.runAllTimersAsync();

        await expect(promise).rejects.toThrow("validation");
        expect(fn).toHaveBeenCalledOnce();
        expect(isRetryable).toHaveBeenCalledOnce();
    });

    it("backs off exponentially between attempts (250 * 2^n + jitter)", async () => {
        const setTimeoutSpy = vi.spyOn(global, "setTimeout");
        const fn = vi
            .fn()
            .mockRejectedValueOnce(new Error("net"))
            .mockRejectedValueOnce(new Error("net"))
            .mockResolvedValueOnce("ok");

        const promise = retryWithBackOff(fn, 3, () => true);
        await vi.runAllTimersAsync();
        await promise;

        const delays = setTimeoutSpy.mock.calls.map((c) => c[1] as number);
        // First backoff: 250ms base + 0-100ms jitter.
        expect(delays[0]).toBeGreaterThanOrEqual(250);
        expect(delays[0]).toBeLessThan(250 + 100);
        // Second backoff: 500ms base + 0-100ms jitter.
        expect(delays[1]).toBeGreaterThanOrEqual(500);
        expect(delays[1]).toBeLessThan(500 + 100);
    });
});