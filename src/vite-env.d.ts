/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK?: "devnet" | "mainnet-beta";
  readonly VITE_RPC_ENDPOINT?: string;
  readonly VITE_DEVNET_RPC_ENDPOINT?: string;
}
