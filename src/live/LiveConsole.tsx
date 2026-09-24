import { ReactNode, useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { useNetwork } from "./LiveProviders";
import { explorerUrl } from "./network";
import { OwnedTokenAccount, buildApproveTx, buildSendSolTx, fetchOwnedTokenAccounts } from "./liveTransactions";
import { adaptWalletAdapter } from "./walletAdapter";
import { InspectionResult } from "../core/types";
import { InspectableTransaction } from "../core/txInspector";
import { Decision, UserRejectedTransactionError, wrapWalletWithFirewall } from "../core/walletMiddleware";
import { TransactionInspectionModal } from "../components/TransactionInspectionModal";

interface LogEntry {
  action: string;
  status: "signed" | "canceled" | "error";
  detail?: string;
}

export function LiveConsole() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { network } = useNetwork();

  const [pending, setPending] = useState<{ result: InspectionResult } | null>(null);
  const resolveRef = useRef<((decision: Decision) => void) | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const [tokenAccounts, setTokenAccounts] = useState<OwnedTokenAccount[]>([]);
  const [tokenAccountsError, setTokenAccountsError] = useState<string | null>(null);

  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("0.01");

  const [approveAccount, setApproveAccount] = useState("");
  const [approveDelegate, setApproveDelegate] = useState("");
  const [approveAmount, setApproveAmount] = useState("1000000");

  useEffect(() => {
    if (!wallet.publicKey) {
      setTokenAccounts([]);
      return;
    }
    setTokenAccountsError(null);
    fetchOwnedTokenAccounts(connection, wallet.publicKey)
      .then((accounts) => {
        setTokenAccounts(accounts);
        if (accounts[0]) setApproveAccount(accounts[0].pubkey);
      })
      .catch((err) => setTokenAccountsError(err instanceof Error ? err.message : String(err)));
  }, [connection, wallet.publicKey, network]);

  const firewall = wrapWalletWithFirewall(adaptWalletAdapter(wallet), {
    gate: (result) =>
      new Promise<Decision>((resolve) => {
        resolveRef.current = resolve;
        setPending({ result });
      })
  });

  function decide(decision: Decision) {
    resolveRef.current?.(decision);
    resolveRef.current = null;
    setPending(null);
  }

  async function runAction(action: string, build: () => Promise<InspectableTransaction>) {
    setBusy(action);
    try {
      const tx = await build();
      const signed = await firewall.signTransaction!(tx);
      setLog((l) => [{ action, status: "signed", detail: "Broadcasting…" }, ...l]);

      const raw = (signed as Transaction | VersionedTransaction).serialize();
      const signature = await connection.sendRawTransaction(raw, { skipPreflight: false });
      await connection.confirmTransaction(signature, "confirmed");

      setLog((l) => [{ action, status: "signed", detail: signature }, ...l.slice(1)]);
    } catch (err) {
      if (err instanceof UserRejectedTransactionError) {
        setLog((l) => [{ action, status: "canceled" }, ...l]);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setLog((l) => [{ action, status: "error", detail: message }, ...l]);
      }
    } finally {
      setBusy(null);
    }
  }

  if (!wallet.connected) {
    return (
      <div className="live-console live-console--disconnected">
        <p className="live-console__blurb">
          Connect a real wallet to build and inspect real transactions — SOL transfers and SPL token approvals — on
          devnet, through the exact same firewall as the demos below. Get devnet SOL from{" "}
          <a href="https://faucet.solana.com" target="_blank" rel="noreferrer">
            faucet.solana.com
          </a>
          .
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  return (
    <div className="live-console">
      <div className="live-console__bar">
        <div className="live-console__wallet">
          <span className="live-console__dot" aria-hidden="true" />
          {wallet.publicKey?.toBase58()}
        </div>
        <span className="live-console__network-badge">{network}</span>
        <WalletMultiButton />
      </div>

      <p className="live-console__hint">
        Live transactions are limited to devnet for now — nothing here can move real funds.
      </p>

      <div className="live-console__grid">
        <ActionCard title="Send SOL" busy={busy === "Send SOL"}>
          <label>
            Recipient address
            <input value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder="Solana address" />
          </label>
          <label>
            Amount (SOL)
            <input value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} inputMode="decimal" />
          </label>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!sendTo || !!busy}
            onClick={() =>
              runAction("Send SOL", () => buildSendSolTx(connection, wallet.publicKey!, sendTo, Number(sendAmount)))
            }
          >
            Build &amp; inspect
          </button>
        </ActionCard>

        <ActionCard title="Approve token delegate" busy={busy === "Approve delegate"}>
          {tokenAccountsError && <p className="live-console__error">{tokenAccountsError}</p>}
          {tokenAccounts.length === 0 && !tokenAccountsError && (
            <p className="live-console__hint">No SPL token accounts with a balance found on {network}.</p>
          )}
          {tokenAccounts.length > 0 && (
            <label>
              Token account
              <select value={approveAccount} onChange={(e) => setApproveAccount(e.target.value)}>
                {tokenAccounts.map((a) => (
                  <option key={a.pubkey} value={a.pubkey}>
                    {a.mint.slice(0, 4)}…{a.mint.slice(-4)} — {a.uiAmount}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Delegate address
            <input value={approveDelegate} onChange={(e) => setApproveDelegate(e.target.value)} placeholder="Solana address" />
          </label>
          <label>
            Amount (raw base units)
            <input value={approveAmount} onChange={(e) => setApproveAmount(e.target.value)} inputMode="numeric" />
          </label>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!approveAccount || !approveDelegate || !!busy}
            onClick={() =>
              runAction("Approve delegate", () =>
                buildApproveTx(connection, wallet.publicKey!, approveAccount, approveDelegate, BigInt(approveAmount || "0"))
              )
            }
          >
            Build &amp; inspect
          </button>
        </ActionCard>

        <ActionCard title="Jupiter swap" busy={false}>
          <p className="live-console__hint">
            Jupiter only routes real mainnet liquidity, so this is disabled while live transactions are limited to
            devnet. Coming soon.
          </p>
        </ActionCard>
      </div>

      <p className="app__section-label">Live log</p>
      <div className="log-panel">
        {log.length === 0 && <div className="log-panel__entry">No live transactions yet.</div>}
        {log.map((entry, i) => (
          <div
            key={i}
            className={`log-panel__entry log-panel__entry--${
              entry.status === "signed" ? "approve" : entry.status === "canceled" ? "reject" : "error"
            }`}
          >
            {entry.status === "canceled" && `CANCELED — ${entry.action}`}
            {entry.status === "error" && `ERROR — ${entry.action}: ${entry.detail}`}
            {entry.status === "signed" &&
              (entry.detail === "Broadcasting…" ? (
                `SIGNED — ${entry.action} — broadcasting…`
              ) : (
                <>
                  SIGNED — {entry.action} —{" "}
                  <a href={explorerUrl(entry.detail!, network)} target="_blank" rel="noreferrer">
                    view on Explorer
                  </a>
                </>
              ))}
          </div>
        ))}
      </div>

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

function ActionCard({ title, busy, children }: { title: string; busy: boolean; children: ReactNode }) {
  return (
    <div className="action-card">
      <h3 className="action-card__title">{title}</h3>
      <div className="action-card__body">{children}</div>
      {busy && <p className="live-console__hint">Working…</p>}
    </div>
  );
}
