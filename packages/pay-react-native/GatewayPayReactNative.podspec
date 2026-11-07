require "json"
package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
    s.name = "GatewayPayReactNative"
    s.version = package["version"]
    s.summary = "Gateway Pay React Native bridge"
    s.homepage = "https://github.com/Tengis0618/gateway-pay-sdk"
    s.license = { :type => "Apache-2.0"}
    s.author = { "Gateway" => "tengis0618@gmail.com"}
    s.platforms = { :ios => "15.0"}
    s.source = { :git => "https://github.com/Tengis0618/gateway-pay-sdk.git", :tag => "v#{s.version}" }
    s.source_files = "ios/**/*.{h,m,swift}"
    s.swift_version = "5.9"

    s.dependency "React-Core"
    s.dependency "GatewayPaySDK"
end