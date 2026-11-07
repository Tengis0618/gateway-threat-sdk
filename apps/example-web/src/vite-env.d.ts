
/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GATEWAY_API_KEY: string;
    readonly VITE_GATEWAY_ENVIRONMENT?: string;
    readonly VITE_GATEWAY_BASE_URL?: string;
    readonly VITE_GATEWAY_HEADER_PREFIX?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
