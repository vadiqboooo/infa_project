/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SELF_EMPLOYED_NAME?: string;
  readonly VITE_SELF_EMPLOYED_INN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
