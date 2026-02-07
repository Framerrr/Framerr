/// <reference types="vite/client" />

/**
 * Vite environment variable types
 */
interface ImportMetaEnv {
    readonly VITE_LOG_LEVEL?: string;
    readonly MODE: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
