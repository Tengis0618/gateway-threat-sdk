import { defineConfig, loadEnv } from "vite";
import fs from "node:fs";
import path from "node:path";

const certDir = path.resolve(__dirname, ".certs");

export default defineConfig(({ command, mode }) => {
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

    // Apple Pay needs HTTPS in the browser, but a production build doesn't need local certificates.
    const https =
        command === "serve"
            ? {
                  key: fs.readFileSync(path.join(certDir, "localhost+2-key.pem")),
                  cert: fs.readFileSync(path.join(certDir, "localhost+2.pem")),
              }
            : undefined;

    return {
        server: {
            port: 5173,
            ...(https && { https }),
            ...(proxy && { proxy }),
        },
        build: {
            target: "es2022", // src/main.ts uses top-level await
            outDir: "dist",
            sourcemap: true,
        },
    };
});
