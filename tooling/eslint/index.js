const tseslint = require("typescript-eslint")
const eslint = require("@eslint/js")

module.exports = tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    {
        languageOptions: {
            parserOptions: {project: true}
        },
        rules: {
            "@typescript-eslint/consistent-type-imports": "error",
            "@typescript-eslint/no-misused-promises": "error",
            "@typescript-eslint/no-floating-promises": "error",
            "no-console": ["warn", {"allow": ["warn", "error"]}]
        }
    },
    {
        ignores: ["dist/**", "build/**", "coverage/**", "node_modules/**"]
    }
)