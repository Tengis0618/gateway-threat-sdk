module.exports = {
    preset: "react-native",
    testEnvironment: "node",
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
    testMatch: ["**/__tests__/**/*.test.(ts|tsx|js|jsx)"],
    transformIgnorePatterns: [
        "node_modules/(?!(?:\\.pnpm/)?(?:@?react-native|@react-navigation|@gateway|jest-react-native|zod))",
    ],
    moduleNameMapper: {
        "^@gateway/pay-core$": "<rootDir>/../core/src/index.ts",
    },
};