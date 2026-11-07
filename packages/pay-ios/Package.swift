// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "GatewayPaySDK",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "GatewayPaySDK", targets: ["GatewayPaySDK"])
    ],
    targets: [
        .target(
            name: "GatewayPaySDK",
            path: "Sources/GatewayPaySDK"
        ),
        .testTarget(
            name: "GatewayPaySDKTests",
            dependencies: ["GatewayPaySDK"],
            path: "Tests/GatewayPaySDKTests"
        )
    ],
    swiftLanguageVersions: [.v5]
)