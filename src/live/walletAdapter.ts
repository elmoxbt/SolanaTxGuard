import type { WalletContextState } from "@solana/wallet-adapter-react";
import { WalletLike } from "../core/walletMiddleware";

/**
 * `@solana/wallet-adapter-react`'s `signTransaction`/`signAllTransactions`
 * are generic (`<T extends Transaction | VersionedTransaction>`), which is
 * more precise than the simplified `WalletLike` shape the firewall exposes
 * — but structurally compatible for every transaction we actually pass
 * through it (always a concrete `Transaction` or `VersionedTransaction`).
 * This adapter is the one place that narrows the type, so the rest of the
 * codebase never has to think about the difference.
 */
export function adaptWalletAdapter(wallet: WalletContextState): WalletLike {
  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction as WalletLike["signTransaction"],
    signAllTransactions: wallet.signAllTransactions as WalletLike["signAllTransactions"]
  };
}
