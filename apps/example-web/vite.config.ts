import { defineConfig, loadEnv } from "vite";
import fs from "node:fs";
import path from "node:path";

const certDir = path.resolve(__dirname, ".certs");

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, __dirname, "");
    const baseUrl = env.VITE_GATEWAY_BASE_URL ?? "";
    const proxyTarget = env.GATEWAY_PROXY_TARGET;

    // A relative base URL is same-origin, so forward it to the gateway to avoid CORS.
    const proxy =
        baseUrl.startsWith("/") && proxyTarget
            ? {
                  [`${baseUrl}/v1`]: {
                      target: proxyTarget,
                      changeOrigin: true,
                      secure: true,
                  },
              }
            : undefined;

    return {
        server: {
            port: 5173,
            https: {
                key: fs.readFileSync(path.join(certDir, "localhost+2-key.pem")),
                cert: fs.readFileSync(path.join(certDir, "localhost+2.pem")),
            },
            ...(proxy && { proxy }),
        },
        build: {
            outDir: "dist",
            sourcemap: true,
        },
    };
});
