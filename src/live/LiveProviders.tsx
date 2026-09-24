import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { ClusterName, DEFAULT_NETWORK, MAINNET_ENABLED, endpointFor } from "./network";

interface NetworkContextValue {
  network: ClusterName;
  setNetwork: (network: ClusterName) => void;
  endpoint: string;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork() must be used inside <LiveProviders>");
  return ctx;
}

/**
 * Wraps the app with real wallet-adapter context. Two things worth
 * knowing:
 *
 * - Most modern wallets (Phantom, Backpack, Solflare, ...) auto-register
 *   themselves via the Wallet Standard and don't need an adapter listed
 *   here at all. We still list Phantom/Solflare's legacy adapters for
 *   users on older wallet versions that predate Standard support.
 * - Switching `network` creates a new `Connection` (ConnectionProvider
 *   re-keys on `endpoint` change) — wallets themselves are
 *   network-agnostic, so no reconnect is required.
 */
export function LiveProviders({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<ClusterName>(DEFAULT_NETWORK);
  const endpoint = useMemo(() => endpointFor(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  // While MAINNET_ENABLED is false, this is a no-op for "mainnet-beta" —
  // there's currently no UI path that calls it with that value anyway
  // (see LiveConsole), but this keeps the guarantee true even if some
  // future code forgets to check the flag itself.
  function setNetwork(next: ClusterName) {
    if (next === "mainnet-beta" && !MAINNET_ENABLED) return;
    setNetworkState(next);
  }

  return (
    <NetworkContext.Provider value={{ network, setNetwork, endpoint }}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </NetworkContext.Provider>
  );
}
