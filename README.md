# SolanaTxGuard — Pre-Sign Transaction Firewall

A middleware layer that sits between a Solana dApp's wallet adapter and the
wallet itself. Every transaction is decoded, its programs identified, its
effects summarized in plain language, and a set of risk flags computed —
**before** the wallet ever prompts the user to sign.

This is not another wallet. It's a security layer that any wallet-adapter
based app (or the wallet itself) can wrap around `signTransaction` /
`signAllTransactions`.

```
TRANSACTION INSPECTION

Program:
Jupiter

Instructions:
✓ Transfer SOL
✓ Token swap

Potential effects:
! Spending 0.43 SOL
! Giving program X authority over token Y

Risk flags:
[1] Token approval
[0] Unknown signer
[0] Suspicious PDA

        CANCEL     SIGN
```

## Why this is harder than it looks

Solana transactions are opaque by default: a signature request is just a
program ID, a list of accounts with signer/writable flags, and a raw byte
buffer. Wallets typically show you that raw shape, not what it *does*.

Two mechanics make this genuinely worth building around:

- **Instructions are program-specific binary layouts.** There's no single
  universal way to decode "what does this do" — the same byte at offset 0
  means "Transfer" in the SPL Token program and something else entirely in
  a random Anchor program. You have to know each program's layout (or
  honestly admit you don't).
- **PDAs let programs hold controlled authority over user assets/state.**
  A Program Derived Address has no private key — nothing can sign for it
  directly — but programs can set a PDA (or any account) as the **owner**
  or **delegate** of a token account via `SetAuthority` / `Approve`. From
  that point on, the program's on-chain logic — not a fresh wallet
  signature — decides what happens to those funds. This is the exact
  mechanism behind both legitimate features (auto-compounding vaults,
  perps collateral) and most "wallet drainer" exploits. The firewall's job
  is to make that moment visible instead of silent.

## Live wallet integration

The app now includes a real integration, not just the offline demo:

- **Real wallets.** `@solana/wallet-adapter-react` connects to whatever
  wallet extension is installed (Phantom, Solflare, Backpack, etc. — most
  auto-register via the Wallet Standard).
- **Real transactions.** "Send SOL" and "Approve token delegate" build
  actual transactions against a live RPC connection (real blockhash, real
  fee payer, and for Approve, the wallet's actual SPL Token accounts
  fetched from chain).
- **Real signing.** Every one of these goes through
  `wrapWalletWithFirewall` exactly like the offline demos — the same
  `TransactionInspectionModal`, the same decoders, the same risk flags —
  and only calls the wallet's real `signTransaction` if you click Sign.
- **Real broadcasting.** Once signed, the app calls
  `connection.sendRawTransaction` and shows the signature with a link to
  Solana Explorer.

**Locked to devnet for now.** `MAINNET_ENABLED` in `src/live/network.ts`
is currently `false`, and it's enforced in three places, not just the UI:
`endpointFor()` refuses to resolve a mainnet endpoint while it's off,
`LiveProviders`'s `setNetwork` is a no-op for `"mainnet-beta"`, and the
network toggle itself isn't rendered — so there's no path, accidental or
otherwise, to a real Connection right now. Get devnet SOL from
[a faucet](https://faucet.solana.com) to try Send SOL and Approve safely;
Jupiter swap is built (`buildJupiterSwapTx` in `liveTransactions.ts`) but
shown as "coming soon" in the console, since Jupiter only routes real
mainnet liquidity — there's nothing to quote on devnet. Flip
`MAINNET_ENABLED` to `true` when you're ready to re-enable mainnet (it
brings back the network toggle and the Jupiter swap card); at that point
signing moves real funds, by design — the whole point of this project is
to be the thing that stands between a real wallet and a real signature —
so treat it with the same care you'd give any dApp requesting mainnet
approvals.

Configuration lives in `.env` (copy `.env.example`):

```bash
VITE_NETWORK=devnet          # has no effect while MAINNET_ENABLED is false
VITE_RPC_ENDPOINT=           # optional: your own mainnet RPC, used once mainnet is re-enabled
VITE_DEVNET_RPC_ENDPOINT=    # optional: your own devnet RPC
```

Without these, the app falls back to `clusterApiUrl()`'s public endpoints,
which are rate-limited and fine for trying things out but not for real use.

## Architecture

```
src/
├── core/
│   ├── types.ts                  Shared types: InspectionResult, RiskFlag, etc.
│   ├── programRegistry.ts        Known program IDs → names/categories
│   ├── pda.ts                    On-curve check → PDA detection
│   ├── instructionDecoders/
│   │   ├── systemProgram.ts      Transfer / CreateAccount / Allocate / Assign
│   │   ├── splToken.ts           Transfer(Checked) / Approve(Checked) /
│   │   │                         Revoke / SetAuthority / MintTo / Burn / Close
│   │   ├── jupiter.ts            Labeled, honestly-opaque aggregator decoder
│   │   ├── generic.ts            Fallback for any unrecognized program
│   │   ├── shared.ts             Account-role + PDA annotation helper
│   │   └── index.ts              Dispatches by program ID
│   ├── instructionBuilders/
│   │   └── splToken.ts           Approve/Revoke instruction builders (shared by demo + live)
│   ├── constants.ts              Shared program-id PublicKeys
│   ├── riskEngine.ts             Instructions/accounts → RiskFlag[] counts
│   ├── txInspector.ts            Transaction | VersionedTransaction → InspectionResult
│   └── walletMiddleware.ts       wrapWalletWithFirewall() — the actual firewall
├── live/
│   ├── LiveProviders.tsx         Wallet-adapter + network context, wraps the app
│   ├── LiveConsole.tsx           Connect wallet → build real tx → inspect → sign → broadcast
│   ├── liveTransactions.ts       Real tx builders: send SOL, approve, Jupiter quote+swap
│   ├── walletAdapter.ts          Adapts wallet-adapter's WalletContextState → WalletLike
│   └── network.ts                Devnet/mainnet endpoint + explorer link config
├── components/
│   ├── TransactionInspectionModal.tsx   The pre-sign panel (matches the mockup)
│   ├── RiskFlag.tsx
│   ├── EffectRow.tsx
│   ├── ProgramBadge.tsx
│   └── components.css
├── demo/
│   └── mockTransactions.ts       Three transactions built locally with web3.js
├── App.tsx                       Wires up both the live console and the offline demos
├── main.tsx
└── styles.css
```

### Pipeline

1. **`txInspector.inspectTransaction(tx)`** normalizes a legacy `Transaction`
   or a v0 `VersionedTransaction` into a flat instruction list plus a fee
   payer. (Address-lookup-table accounts that can't be resolved offline are
   decoded as far as possible and flagged as `truncated`.)
2. Each instruction is routed by program ID to a **decoder**
   (`instructionDecoders/`). A decoder never guesses: if it doesn't
   recognize the instruction layout, it says so (`opaque: true`) rather
   than fabricating a description.
3. Decoded instructions produce **effects** (plain-language, e.g. "Giving a
   program delegate authority over token account 7f3…9k2") and structural
   facts about every account (`isSigner`, `isWritable`, `isPDA`).
4. **`riskEngine.computeRiskFlags`** turns those structural facts into the
   bracketed counts in the panel — `[1] Token approval`, `[0] Unknown
   signer`, `[0] Suspicious PDA` — each one provably true of the
   transaction, not a heuristic guess about intent.
5. **`walletMiddleware.wrapWalletWithFirewall`** wraps any wallet-adapter-
   shaped object so `signTransaction`/`signAllTransactions` run the above
   pipeline and await a user decision (via your `gate` function — normally
   "render `TransactionInspectionModal` and wait for Sign/Cancel") before
   the underlying wallet ever sees the transaction.

## Running it

```bash
npm install
cp .env.example .env   # optional — see "Live wallet integration" below
npm run dev
```

Open the printed local URL. The page has two sections: a **Live** console
at the top (connect a real wallet, build real transactions — see below)
and an **offline demo** section below it that needs no wallet at all.
Three demo transactions there are built entirely client-side with
`@solana/web3.js` (no RPC connection, no real wallet needed):

- **Jupiter swap + token approval** — the scenario from the brief: a SOL
  transfer bundled with a token `Approve`, routed through Jupiter.
- **Plain SOL transfer** — nothing to flag, all risk counts at `[0]`.
- **Unrecognized program + PDA authority** — an unregistered program ID
  taking a second signer and a writable PDA, lighting up every flag.

Click "Inspect & sign" on any of them to see the panel; Cancel/Sign both
resolve the underlying (fake) `signTransaction` promise, and the decision
is logged below.

## Using it for real

`src/live/LiveConsole.tsx` is a complete, working example — this is the
same pattern to copy into your own app:

```ts
import { useWallet } from "@solana/wallet-adapter-react";
import { adaptWalletAdapter } from "./live/walletAdapter";
import { wrapWalletWithFirewall } from "./core/walletMiddleware";

const wallet = useWallet(); // publicKey, signTransaction, signAllTransactions
const guardedWallet = wrapWalletWithFirewall(adaptWalletAdapter(wallet), {
  gate: (result) =>
    new Promise((resolve) => {
      // Render <TransactionInspectionModal result={result}
      //   onApprove={() => resolve("approve")}
      //   onReject={() => resolve("reject")} />
    }),
  // Optional: skip the modal entirely for transactions the firewall
  // considers routine.
  autoApproveSeverities: []
});

const signed = await guardedWallet.signTransaction!(tx); // firewall-checked
const signature = await connection.sendRawTransaction(signed.serialize());
```

`adaptWalletAdapter` exists because wallet-adapter's `signTransaction` is
generic (`<T extends Transaction | VersionedTransaction>`), which is more
precise than `WalletLike` needs to be — it's the one place that narrows
the type, so the rest of the codebase doesn't have to think about it. Any
object matching `WalletLike` (`publicKey` / `signTransaction` /
`signAllTransactions`) works with `wrapWalletWithFirewall` directly,
adapter or not — that shape is what both the Wallet Standard and
`@solana/wallet-adapter-base` already expose, so this wraps Phantom,
Backpack, Solflare, etc. without any wallet-specific code.

## Honest limitations

- **Decoder coverage is intentionally small, not exhaustive.** System
  Program and SPL Token/Token-2022 are fully decoded because their layouts
  are simple and stable. Anchor programs (Jupiter included) use per-program
  8-byte discriminators and custom account structs — decoding those
  properly means shipping each program's IDL. The Jupiter decoder is
  deliberately labeled "best-effort / opaque" rather than pretending to
  know what it doesn't; the underlying SPL Token instructions inside the
  same transaction (the actual approvals/transfers) are still fully
  decoded and flagged.
- **PDA detection is the standard heuristic**, not a proof: an off-curve
  address is *almost certainly* a PDA, but this doesn't verify it derives
  from any particular seed set without the seeds in hand.
- **Address lookup tables** used by `VersionedTransaction`s can't be
  resolved without an RPC round-trip; the inspector decodes the static
  accounts it can see and flags the result as a lower bound.
- This is a decoding and risk-surfacing layer, not a simulation engine —
  it doesn't execute the transaction against cluster state, so it can't
  catch effects that only appear from a full `simulateTransaction` (e.g.
  slippage beyond what's encoded in the instruction itself).
- `LiveConsole`'s `confirmTransaction(signature, "confirmed")` call uses
  web3.js's simpler (deprecated but functional) confirmation overload for
  brevity. Production code should pass the blockhash/lastValidBlockHeight
  strategy returned alongside the signature instead, to get proper
  expiry-based confirmation.
- Public RPC endpoints (the `clusterApiUrl()` fallback used when no
  `VITE_RPC_ENDPOINT` is set) are rate-limited and can intermittently fail
  under load — expected for a demo, not something you'd want unmodified
  in production.

## License

MIT — see `LICENSE`.
