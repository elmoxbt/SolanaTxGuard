import { InspectableTransaction, inspectTransaction } from "./txInspector";
import { InspectionResult } from "./types";

/**
 * The minimal shape we need from a wallet adapter. Real wallets
 * (Phantom, Backpack, Solflare, …) expose exactly this surface via the
 * Wallet Standard / @solana/wallet-adapter-base, so this middleware wraps
 * around any of them without needing to know which one it is.
 */
export interface WalletLike {
  publicKey: { toBase58(): string } | null;
  signTransaction?(transaction: InspectableTransaction): Promise<InspectableTransaction>;
  signAllTransactions?(transactions: InspectableTransaction[]): Promise<InspectableTransaction[]>;
}

export type Decision = "approve" | "reject";

/**
 * Called for every transaction before it reaches the real wallet.
 * Return "approve" to let it through to `wallet.signTransaction`, or
 * "reject" to throw instead. This is where the UI (the inspection modal)
 * plugs in — it's just a function from `InspectionResult` to a user's
 * decision.
 */
export type PreSignGate = (result: InspectionResult, tx: InspectableTransaction) => Promise<Decision>;

export class UserRejectedTransactionError extends Error {
  constructor(public readonly result: InspectionResult) {
    super("Transaction rejected in pre-sign inspection.");
    this.name = "UserRejectedTransactionError";
  }
}

export interface FirewallOptions {
  /** Called with the inspection result for every transaction, before signing. */
  gate: PreSignGate;
  /**
   * Severities that bypass the gate entirely and sign immediately, e.g.
   * `[]` to always show the panel, or `["info"]` to skip it for
   * transactions the firewall considers routine. Defaults to never
   * auto-approving anything.
   */
  autoApproveSeverities?: InspectionResult["overallSeverity"][];
}

/**
 * Wraps a wallet adapter so that `signTransaction` and
 * `signAllTransactions` run every transaction through the inspector and
 * the caller-supplied gate first. The returned object has the exact same
 * shape as the wallet it wraps, so it's a drop-in replacement anywhere a
 * `WalletLike` is expected (e.g. as the `wallet` passed to
 * `@solana/wallet-adapter-react`'s context, or directly in app code).
 */
export function wrapWalletWithFirewall<W extends WalletLike>(wallet: W, options: FirewallOptions): W {
  const autoApprove = new Set(options.autoApproveSeverities ?? []);

  async function guard<T extends InspectableTransaction>(tx: T): Promise<T> {
    const result = inspectTransaction(tx);

    if (autoApprove.has(result.overallSeverity)) {
      return tx;
    }

    const decision = await options.gate(result, tx);
    if (decision === "reject") {
      throw new UserRejectedTransactionError(result);
    }
    return tx;
  }

  return {
    ...wallet,
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction
      ? async (transaction: InspectableTransaction) => {
          const checked = await guard(transaction);
          return wallet.signTransaction!(checked);
        }
      : undefined,
    signAllTransactions: wallet.signAllTransactions
      ? async (transactions: InspectableTransaction[]) => {
          const checked = await Promise.all(transactions.map((t) => guard(t)));
          return wallet.signAllTransactions!(checked);
        }
      : undefined
  } as W;
}
