import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "../client";
import { ErrorCode } from "../../types/error";

const BASE_URL = "https://gateway.example.com";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(body), { ...init, headers });
}

describe("HttpClient", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("sends requests to the configured baseUrl", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
        const client = new HttpClient({
            apiKey: "pk_test",
            environment: "sandbox",
            baseUrl: BASE_URL,
            fetchImpl,
            maxRetries: 0,
        });

        await client.request({ method: "POST", path: "/v1/session" });

        expect(fetchImpl).toHaveBeenCalledOnce();
        const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${BASE_URL}/v1/session`);
        expect(init.method).toBe("POST");
    });

    it("requires a baseUrl instead of falling back to a built-in host", () => {
        expect(
            () => new HttpClient({ apiKey: "k", environment: "production", baseUrl: "" }),
        ).toThrow("baseUrl is required");
    });

    it("sends neutral identification headers by default", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
        const client = new HttpClient({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: BASE_URL,
            fetchImpl,
            maxRetries: 0,
        });

        await client.request({ method: "POST", path: "/v1/session" });

        const headers = (fetchImpl.mock.calls[0] as [string, RequestInit])[1].headers as Record<
            string,
            string
        >;
        expect(headers["X-Pay-Gateway"]).toBeDefined();
        expect(headers["X-Pay-Version"]).toBeDefined();
    });

    it("applies a configured headerPrefix", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
        const client = new HttpClient({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: BASE_URL,
            headerPrefix: "X-Acme",
            fetchImpl,
            maxRetries: 0,
        });

        await client.request({ method: "POST", path: "/v1/session" });

        const headers = (fetchImpl.mock.calls[0] as [string, RequestInit])[1].headers as Record<
            string,
            string
        >;
        expect(headers["X-Acme-Gateway"]).toBeDefined();
        expect(headers["X-Acme-Version"]).toBeDefined();
        expect(headers["X-Pay-Gateway"]).toBeUndefined();
    });

    it("attaches Bearer auth and JSON headers", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
        const client = new HttpClient({
            apiKey: "pk_test",
            environment: "sandbox",
            baseUrl: BASE_URL,
            fetchImpl,
            maxRetries: 0,
        });

        await client.request({
            method: "POST",
            path: "/v1/payments",
            body: {},
            idempotencyKey: "6f8e0b6a-2e57-4d5f-8a5d-6c9b6b1a2f3e",
        });

        const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer pk_test");
        expect(headers["Content-Type"]).toBe("application/json");
        expect(headers["Idempotency-Key"]).toBe("6f8e0b6a-2e57-4d5f-8a5d-6c9b6b1a2f3e");
    });

    it("auto-generates a UUID-shaped Idempotency-Key when the caller omits one", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
        const client = new HttpClient({
            apiKey: "pk_test",
            environment: "sandbox",
            baseUrl: BASE_URL,
            fetchImpl,
            maxRetries: 0,
        });

        await client.request({ method: "POST", path: "/v1/session" });

        const headers = (fetchImpl.mock.calls[0] as [string, RequestInit])[1].headers as Record<
            string,
            string
        >;
        expect(headers["Idempotency-Key"]).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
    });

    it("serialises the body as JSON", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
        const client = new HttpClient({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: BASE_URL,
            fetchImpl,
            maxRetries: 0,
        });

        await client.request({
            method: "POST",
            path: "/v1/x",
            body: { hello: "world", n: 42 },
        });

        const init = (fetchImpl.mock.calls[0] as [string, RequestInit])[1];
        expect(init.body).toBe('{"hello":"world","n":42}');
    });

    it("omits the body entirely when the caller passes undefined", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
        const client = new HttpClient({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: BASE_URL,
            fetchImpl,
            maxRetries: 0,
        });

        await client.request({ method: "POST", path: "/v1/x" });

        const init = (fetchImpl.mock.calls[0] as [string, RequestInit])[1];
        expect(init.body).toBeUndefined();
    });

    // HTTP status → ErrorCode mapping table (matches client.ts:mapHttpError)
    it.each([
        [401, ErrorCode.InvalidApiKey],
        [403, ErrorCode.SessionExpired],
        [422, ErrorCode.ValidationFailed],
        [429, ErrorCode.RateLimited],
        [500, ErrorCode.Internal],
        [418, ErrorCode.Internal],
    ])("maps HTTP %i to error code %s", async (status, expectedCode) => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(jsonResponse({ message: "nope" }, { status, statusText: "Error" }));
        const client = new HttpClient({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: BASE_URL,
            maxRetries: 0,
            fetchImpl,
        });

        await expect(client.request({ method: "POST", path: "/v1/x" })).rejects.toMatchObject({
            code: expectedCode,
            httpStatus: status,
        });
    });

    it("captures the request id from x-request-id on error responses", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(
            jsonResponse(
                { message: "bad" },
                { status: 422, headers: { "x-request-id": "req_abc" } },
            ),
        );
        const client = new HttpClient({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: BASE_URL,
            maxRetries: 0,
            fetchImpl,
        });

        await expect(client.request({ method: "POST", path: "/v1/x" })).rejects.toMatchObject({
            requestId: "req_abc",
        });
    });

    it("falls back to statusText when the error body isn't JSON", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(
            new Response("not json", { status: 500, statusText: "Internal Server Error" }),
        );
        const client = new HttpClient({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: BASE_URL,
            maxRetries: 0,
            fetchImpl,
        });

        await expect(client.request({ method: "POST", path: "/v1/x" })).rejects.toMatchObject({
            message: "Internal Server Error",
        });
    });

    it("returns undefined on 204 No Content", async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
        const client = new HttpClient({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: BASE_URL,
            fetchImpl,
            maxRetries: 0,
        });

        const result = await client.request({ method: "DELETE", path: "/v1/x" });
        expect(result).toBeUndefined();
    });

    it("wraps a fetch throw as a NetworkError", async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new TypeError("connection refused"));
        const client = new HttpClient({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: BASE_URL,
            maxRetries: 0,
            fetchImpl,
        });

        await expect(client.request({ method: "POST", path: "/v1/x" })).rejects.toMatchObject({
            code: ErrorCode.NetworkError,
        });
    });

    it("retries transient network failures and eventually succeeds", async () => {
        const fetchImpl = vi
            .fn()
            .mockRejectedValueOnce(new TypeError("first"))
            .mockRejectedValueOnce(new TypeError("second"))
            .mockResolvedValueOnce(jsonResponse({ ok: true }));
        const client = new HttpClient({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: BASE_URL,
            maxRetries: 3,
            fetchImpl,
        });

        const promise = client.request<{ ok: boolean }>({ method: "POST", path: "/v1/x" });
        await vi.runAllTimersAsync();

        await expect(promise).resolves.toEqual({ ok: true });
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it("reuses one generated Idempotency-Key across retries of a request", async () => {
        const fetchImpl = vi
            .fn()
            .mockRejectedValueOnce(new TypeError("first"))
            .mockRejectedValueOnce(new TypeError("second"))
            .mockResolvedValueOnce(jsonResponse({ ok: true }));
        const client = new HttpClient({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: BASE_URL,
            maxRetries: 2,
            fetchImpl,
        });

        const promise = client.request({ method: "POST", path: "/v1/payments", body: {} });
        await vi.runAllTimersAsync();
        await promise;

        const keys = fetchImpl.mock.calls.map(
            (call) =>
                ((call as [string, RequestInit])[1].headers as Record<string, string>)[
                    "Idempotency-Key"
                ],
        );
        expect(keys).toHaveLength(3);
        expect(new Set(keys).size).toBe(1);
    });

    it("generates a different Idempotency-Key for each separate request", async () => {
        const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({})));
        const client = new HttpClient({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: BASE_URL,
            maxRetries: 0,
            fetchImpl,
        });

        await client.request({ method: "POST", path: "/v1/payments", body: {} });
        await client.request({ method: "POST", path: "/v1/payments", body: {} });

        const keys = fetchImpl.mock.calls.map(
            (call) =>
                ((call as [string, RequestInit])[1].headers as Record<string, string>)[
                    "Idempotency-Key"
                ],
        );
        expect(new Set(keys).size).toBe(2);
    });

    it("does NOT retry validation errors (422)", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(jsonResponse({ message: "bad" }, { status: 422 }));
        const client = new HttpClient({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: BASE_URL,
            maxRetries: 3,
            fetchImpl,
        });

        const promise = client.request({ method: "POST", path: "/v1/x" });
        promise.catch(() => {})
        await vi.runAllTimersAsync();

        await expect(promise).rejects.toMatchObject({ code: ErrorCode.ValidationFailed });
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it("does NOT retry auth errors (401)", async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(jsonResponse({ message: "nope" }, { status: 401 }));
        const client = new HttpClient({
            apiKey: "k",
            environment: "sandbox",
            baseUrl: BASE_URL,
            maxRetries: 3,
            fetchImpl,
        });

        const promise = client.request({ method: "POST", path: "/v1/x" });
        promise.catch(() => {})
        await vi.runAllTimersAsync();

        await expect(promise).rejects.toMatchObject({ code: ErrorCode.InvalidApiKey });
        expect(fetchImpl).toHaveBeenCalledOnce();
    });
});