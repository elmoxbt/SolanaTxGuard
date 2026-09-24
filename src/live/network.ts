import { clusterApiUrl } from "@solana/web3.js";

export type ClusterName = "devnet" | "mainnet-beta";

/**
 * Mainnet support is disabled for now — this flag is the single switch
 * that turns it back on later (re-enables the network toggle and the
 * Jupiter swap card in LiveConsole). Until then the app only ever
 * connects to devnet, regardless of env config, so nothing here can move
 * real funds.
 */
export const MAINNET_ENABLED = false;

/** Currently always "devnet" while MAINNET_ENABLED is false. */
export const DEFAULT_NETWORK: ClusterName = MAINNET_ENABLED
  ? (import.meta.env.VITE_NETWORK as ClusterName | undefined) ?? "devnet"
  : "devnet";

export function endpointFor(network: ClusterName): string {
  if (network === "mainnet-beta" && !MAINNET_ENABLED) {
    // Belt-and-suspenders: even if something upstream slips a
    // "mainnet-beta" value through, never actually point a Connection at
    // mainnet while the feature is switched off.
    return endpointFor("devnet");
  }
  if (network === "mainnet-beta" && import.meta.env.VITE_RPC_ENDPOINT) {
    return import.meta.env.VITE_RPC_ENDPOINT as string;
  }
  if (network === "devnet" && import.meta.env.VITE_DEVNET_RPC_ENDPOINT) {
    return import.meta.env.VITE_DEVNET_RPC_ENDPOINT as string;
  }
  // clusterApiUrl's public endpoints are rate-limited and fine for a demo,
  // but not for real usage — see the README for how to plug in a paid RPC
  // provider (Helius, Triton, QuickNode, ...) via .env.
  return clusterApiUrl(network);
}

export function explorerUrl(signature: string, network: ClusterName): string {
  const cluster = network === "mainnet-beta" ? "" : `?cluster=${network}`;
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}
