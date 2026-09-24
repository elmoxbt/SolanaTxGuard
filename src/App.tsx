import { useRef, useState } from "react";
import { Transaction } from "@solana/web3.js";
import { InspectionResult } from "./core/types";
import { Decision, UserRejectedTransactionError, WalletLike, wrapWalletWithFirewall } from "./core/walletMiddleware";
import { buildJupiterSwapWithApproval, buildSimpleTransfer, buildSuspiciousUnknownProgram } from "./demo/mockTransactions";
import { TransactionInspectionModal } from "./components/TransactionInspectionModal";
import { LiveConsole } from "./live/LiveConsole";

/**
 * Stands in for a real wallet adapter (Phantom, Backpack, Solflare, ...).
 * `signTransaction` here just returns the transaction unchanged — the
 * point of the demo is what happens *before* this ever runs.
 */
const fakeWallet: WalletLike = {
  publicKey: { toBase58: () => "Demo1111111111111111111111111111111111111" },
  signTransaction: async (tx) => tx
};

type DemoBuilder = () => { label: string; tx: Transaction };

const DEMOS: DemoBuilder[] = [buildJupiterSwapWithApproval, buildSimpleTransfer, buildSuspiciousUnknownProgram];

interface LogEntry {
  label: string;
  decision: Decision;
}

export default function App() {
  const [pending, setPending] = useState<{ result: InspectionResult } | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const resolveRef = useRef<((decision: Decision) => void) | null>(null);

  const firewall = wrapWalletWithFirewall(fakeWallet, {
    gate: (result) =>
      new Promise<Decision>((resolve) => {
        resolveRef.current = resolve;
        setPending({ result });
      })
  });

  async function runDemo(build: DemoBuilder) {
    const { label, tx } = build();
    try {
      await firewall.signTransaction!(tx);
      setLog((l) => [{ label, decision: "approve" }, ...l]);
    } catch (err) {
      if (err instanceof UserRejectedTransactionError) {
        setLog((l) => [{ label, decision: "reject" }, ...l]);
      } else {
        throw err;
      }
    }
  }

  function decide(decision: Decision) {
    resolveRef.current?.(decision);
    resolveRef.current = null;
    setPending(null);
  }

  return (
    <div className="app">
      <header className="app__header">
        <p className="app__wordmark">SolanaTxGuard</p>
        <h1 className="app__title">Pre-sign transaction firewall for Solana wallets</h1>
        <p className="app__subtitle">
          A middleware layer that sits between your wallet adapter and the wallet itself. Every transaction is
          decoded, its programs identified, its effects summarized in plain language, and its risk flags computed —
          before your wallet ever gets a chance to prompt you to sign.
        </p>
      </header>

      <p className="app__section-label">Live — connect a real wallet</p>
      <LiveConsole />

      <p className="app__section-label">Try it offline — each button runs a mock transaction through the firewall</p>
      <div className="demo-grid">
        {DEMOS.map((build) => {
          const preview = build();
          return (
            <div className="demo-card" key={preview.label}>
              <div className="demo-card__text">
                <span className="demo-card__label">{preview.label}</span>
                <span className="demo-card__hint">{preview.tx.instructions.length} instruction(s), unsigned</span>
              </div>
              <button type="button" className="btn btn--ghost" style={{ flex: "none", padding: "10px 18px" }} onClick={() => runDemo(build)}>
                Inspect &amp; sign
              </button>
            </div>
          );
        })}
      </div>

      <p className="app__section-label">Decision log</p>
      <div className="log-panel">
        {log.length === 0 && <div className="log-panel__entry">No transactions inspected yet.</div>}
        {log.map((entry, i) => (
          <div key={i} className={`log-panel__entry log-panel__entry--${entry.decision}`}>
            {entry.decision === "approve" ? "SIGNED  " : "CANCELED"} — {entry.label}
          </div>
        ))}
      </div>

      <footer className="app__footer">
        The offline demos above build transactions locally with @solana/web3.js — nothing is sent to a wallet or a
        cluster. The Live section actually connects to a real wallet and a real RPC endpoint (devnet by default) and
        will broadcast anything you sign. To wire the firewall into your own app, wrap your wallet adapter with{" "}
        <code>wrapWalletWithFirewall</code> from <code>src/core/walletMiddleware.ts</code> — see{" "}
        <code>src/live/LiveConsole.tsx</code> for a full working example, and the README for the integration guide.
      </footer>

      {pending && (
        <TransactionInspectionModal
          result={pending.result}
          onApprove={() => decide("approve")}
          onReject={() => decide("reject")}
        />
      )}
    </div>
  );
}
