/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TWELVEDATA_API_KEY?: string;
  readonly VITE_STOOQ_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
