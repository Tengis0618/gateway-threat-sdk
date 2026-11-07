import { NativeModule, Platform, Linking, NativeModules } from "react-native";
import {
    paymentRequestSchema, validate, GatewayError, ErrorCode, type Environment, type PaymentRequest, type PaymentResponse 
} from "@gateway/pay-core";

interface NativeGatewayPay {
    configure(apiKey: string, environment: Environment, baseUrl: string, headerPrefix: string | null): Promise<void>;
    canMakePayments(): Promise<boolean>;
    authorize(request: PaymentRequest): Promise<PaymentResponse>;
}

const native: NativeGatewayPay | undefined = NativeModules.GatewayPay;

export interface GatewayPayOptions {
    apiKey: string,
    environment: Environment,
    baseUrl: string,
    headerPrefix?: string,
    //Web fallback url used on android
    webCheckoutUrl: string;
}

export class GatewayPay {
    constructor(private readonly opts: GatewayPayOptions) {
        if (Platform.OS === "ios") {
            if (!native) throw new Error("GatewayPay native module not linked")
            void native.configure(opts.apiKey, opts.environment, opts.baseUrl, opts.headerPrefix ?? null)
        }
    }

    async canMakePayments(): Promise<boolean> {
        if (Platform.OS === "ios") return native!.canMakePayments();
        return Promise.resolve(!!this.opts.webCheckoutUrl);
    }

    async authorize(request: PaymentRequest): Promise<PaymentResponse> {
        const validated = validate(paymentRequestSchema, request) as PaymentRequest;
    
        if (Platform.OS === "ios") {
            return native!.authorize(validated);
        }

        if (this.opts.webCheckoutUrl) {
            await Linking.openURL(this.opts.webCheckoutUrl);
            throw new GatewayError(ErrorCode.ApplePayUnavailable, "Redirected to web checkout on Android");
        }

        throw new GatewayError(ErrorCode.ApplePayUnavailable, "Apple Pay is IOS-only");
    }
}

export * from "@gateway/pay-core";