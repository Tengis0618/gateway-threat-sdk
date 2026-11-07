#import <React/RCTBridgeModule.h>;

@interface RCT_EXTERN_MODULE(GatewayPay, NSObject)

RCT_EXTERN_METHOD(configure:(NSString *)apiKey
                  environment:(NSString *)environment
                  baseUrl:(NSString *)baseUrl
                  headerPrefix:(nullable NSString *)headerPrefix
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(canMakePayments:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(authorize:(NSDictionary *)request

                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end