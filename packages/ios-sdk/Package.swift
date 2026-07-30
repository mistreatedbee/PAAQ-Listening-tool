// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "PaaqIntelligence",
    platforms: [
        .iOS(.v15),
        .macOS(.v12),
        .tvOS(.v15),
        .watchOS(.v8),
    ],
    products: [
        .library(name: "PaaqIntelligence", targets: ["PaaqIntelligence"]),
    ],
    targets: [
        .target(
            name: "PaaqIntelligence",
            path: "Sources/PaaqIntelligence"
        ),
    ]
)
