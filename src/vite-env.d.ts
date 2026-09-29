/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TIMEOUT_MS?: string;
  readonly VITE_IDLE_TIMEOUT_SECONDS?: string;
  readonly VITE_IDLE_WARNING_SECONDS?: string;
  readonly VITE_ENABLE_MOCK_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
