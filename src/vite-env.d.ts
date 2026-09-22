/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_TWELVEDATA_API_KEY?: string;
  readonly VITE_STOOQ_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
