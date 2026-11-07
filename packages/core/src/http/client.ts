import type { Environment } from "../types/environment";
import { GatewayError, ErrorCode } from "../types/error";
import { retryWithBackOff } from "./retry";
import { buildHeaders } from "./headers";


export interface ClientOptions {
    apiKey: string;
    environment: Environment;
    maxRetries?: number; //max number of retires for idempotent requests
    baseUrl: string; //gateway URL, including any path prefix
    headerPrefix?: string; //prefix for the SDK identification headers
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
}

export interface RequestOptions {
    method: "GET" | "POST" | "PUT" | "DELETE";
    path: string;
    body?: unknown;
    idempotencyKey?: string;
    signal?: AbortSignal;

}

export class HttpClient {
    private readonly baseUrl: string;
    private readonly fetchImpl: typeof fetch;

    constructor(private readonly opts: ClientOptions){
        if (!opts.baseUrl) throw GatewayError.validation("baseUrl is required");
        this.baseUrl = opts.baseUrl;
        this.fetchImpl = opts.fetchImpl ?? fetch;
    }

    async request<T>(req: RequestOptions): Promise<T> {
        //fixed before the retry loop: every attempt must send the same key so
        //the gateway can dedupe a retry whose earlier attempt actually landed
        const idempotencyKey = req.idempotencyKey ?? crypto.randomUUID();

        return retryWithBackOff(
        ()=> this.executeOnce<T>(req, idempotencyKey),
        this.opts.maxRetries ?? 2,
        (e) => e instanceof GatewayError && (e.code === ErrorCode.NetworkError || e.code === ErrorCode.Timeout)
        )
    }

    private async executeOnce<T>(req: RequestOptions, idempotencyKey: string): Promise<T> {
        const url = `${this.baseUrl}${req.path}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? 30_000);

        if (req.signal) {
            req.signal.addEventListener("abort", () => controller.abort());
        }

        try {
            const init: RequestInit = {
                method: req.method,
                headers: buildHeaders(this.opts.apiKey, idempotencyKey, this.opts.headerPrefix),
                signal: controller.signal
            };

            if (req.body !== undefined) {
                init.body = JSON.stringify(req.body);
            }

            const res = await this.fetchImpl(url, init);

            const requestId = res.headers.get("x-request-id") ?? undefined;
            if (!res.ok) throw await mapHttpError(res, requestId);

            if (res.status == 204) return undefined as T;
            return (await res.json()) as T;
        } catch (err) {
            if (err instanceof GatewayError) throw err;
            if (controller.signal.aborted) {
                throw new GatewayError(ErrorCode.Timeout, "Request timed out");
            }
            throw GatewayError.network(err);
        } finally {
            clearTimeout(timeout);
        }
    }
}

async function mapHttpError(res: Response, requestId?: string): Promise<GatewayError> {
    type ErrorBody = { code?: string; message?: string};
    const body: ErrorBody = await res.json().catch(() => ({}));
    const message = body.message ?? res.statusText;

    switch(res.status) {
        case 401: return new GatewayError(ErrorCode.InvalidApiKey, message, 401, requestId);
        case 403: return new GatewayError(ErrorCode.SessionExpired, message, 403, requestId);
        case 422: return new GatewayError(ErrorCode.ValidationFailed, message, 422, requestId);
        case 429: return new GatewayError(ErrorCode.RateLimited, message, 429, requestId);
        default: return new GatewayError(ErrorCode.Internal, message, res.status, requestId);
    }
}