export const ErrorCode = {
    NetworkError: "NETWORK_ERROR",
    Timeout: "TIMEOUT",
    InvalidApiKey: "INVALID_API_KEY",
    SessionExpired: "SESSION_EXPIRED",
    ValidationFailed: "VALIDATION_FAILED",
    ApplePayUnavailable: "APPLE_PAY_UNAVAILABLE",
    UserCancelled: "USER_CANCELLED",
    Declined: "DECLINED",
    Internal: "INTERNAL",
    RateLimited: "RATE_LIMITED"
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class GatewayError extends Error {
    constructor(
        public readonly code: ErrorCode,
        message: string,
        public readonly httpStatus?: number,
        public readonly requestId?: string,
        public readonly cause?: unknown,
    ){
        super(message);
        this.name = "GatewayError";
    }

    static network(cause?: unknown): GatewayError {
        return new GatewayError(ErrorCode.NetworkError, "Network request failed", undefined, undefined, cause);
    }

    static validation(message: string): GatewayError {
        return new GatewayError(ErrorCode.ValidationFailed, message);
    }
}