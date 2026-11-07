/// <reference types="applepayjs" />
export {};

export type ApplePayCapabilityStatus = 
  | "paymentCredentialsAvailable"
  | "paymentCredentialsUnavailable"
  | "paymentCredentialStatusUnknown"
  | "applePayUnsupported";

export interface ApplePayCapabilities {
  paymentCredentialStatus: ApplePayCapabilityStatus;
}

declare global {
  interface Window {
    ApplePaySession: typeof ApplePaySession;
  }

  const ApplePaySession: {
    prototype: ApplePaySession;
    new (version: number, request: any): ApplePaySession;
    canMakePayments(): boolean;
    applePayCapabalities?: (merchantIdentifier: string) => Promise<ApplePayCapabilities>;
    STATUS_SUCCESS: number;
    STATUS_FAILURE: number;
  };
}