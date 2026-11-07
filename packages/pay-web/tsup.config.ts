import { defineConfig } from "tsup"; 

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: {
        resolve: true
    },
    sourcemap: true,
    clean: true,
    treeshake: true,
    target: "es2020",
    tsconfig: "./tsconfig.tsup.json"
});