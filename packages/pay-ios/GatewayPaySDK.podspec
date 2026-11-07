#require "json"
#package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
    s.name = 'GatewayPaySDK'
    s.version = '1.0.0'
    s.summary = "Apple Pay SDK Gateway"
    s.homepage = "https://github.com/Tengis0618/gateway-pay-sdk"
    s.license = { :type => "Apache-2.0"}
    s.author = { "Gateway" => "tengis0618@gmail.com"}
    s.platform = :ios, "15.0"
    s.source = { :git => "https://github.com/Tengis0618/gateway-pay-sdk.git", :tag => s.version.to_s}
    s.source_files = 'Sources/GatewayPaySDK/**/*.{swift,h,m}'
    s.swift_version = "5.9"
    s.frameworks = 'PassKit', 'Foundation'
end