const SDK_VERSION = "1.0.0";

export const DEFAULT_HEADER_PREFIX = "X-Pay";

export function buildHeaders(
    apiKey: string,
    idempotencyKey?: string,
    headerPrefix: string = DEFAULT_HEADER_PREFIX,
): HeadersInit {
    return {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Idempotency-Key": idempotencyKey ?? crypto.randomUUID(),
        [`${headerPrefix}-Gateway`]: "@Gateway/pay-core",
        [`${headerPrefix}-Version`]: SDK_VERSION
    }
}
