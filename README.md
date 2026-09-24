# SolanaTxGuard — Pre-Sign Transaction Firewall

Live demo: https://solanatxguard.vercel.app (devnet only)

Middleware that decodes a Solana transaction, identifies its programs,
summarizes its effects in plain language, and computes risk flags —
before the transaction reaches a wallet's `signTransaction` call. It wraps
a wallet-adapter-compatible wallet rather than replacing it.

## Architecture

```
src/
├── core/
│   ├── instructionDecoders/   Per-program decoders (System, SPL Token,
│   │                          Jupiter best-effort, generic fallback)
│   ├── instructionBuilders/   Shared SPL Token instruction builders
│   ├── constants.ts           Program-id PublicKeys
│   ├── programRegistry.ts     Known program-id → name/category lookup
│   ├── pda.ts                 PDA detection (ed25519 on-curve check)
│   ├── riskEngine.ts          Decoded instructions → RiskFlag[] counts
│   ├── txInspector.ts         Transaction | VersionedTransaction → InspectionResult
│   └── walletMiddleware.ts    wrapWalletWithFirewall()
├── live/
│   ├── LiveProviders.tsx      Wallet-adapter + network context
│   ├── LiveConsole.tsx        Connect wallet → build tx → inspect → sign → broadcast
│   ├── liveTransactions.ts    Real tx builders (send SOL, approve, Jupiter swap)
│   ├── walletAdapter.ts       Adapts WalletContextState → WalletLike
│   └── network.ts             Cluster/endpoint config
├── components/                Inspection panel UI
├── demo/                      Offline mock transactions (no wallet/RPC needed)
└── App.tsx
```

Pipeline: `txInspector.inspectTransaction()` normalizes the transaction →
each instruction is routed by program ID to a decoder → decoders produce
plain-language effects and per-account facts (`isSigner`, `isWritable`,
`isPDA`) → `riskEngine.computeRiskFlags()` turns those facts into counts →
`wrapWalletWithFirewall()` gates `signTransaction`/`signAllTransactions`
on a user decision before calling the underlying wallet.

## Running locally

```bash
npm install
cp .env.example .env   # optional, see below
npm run dev
```

The app has two sections: a live console at the top (real wallet, real
transactions) and an offline demo below it (no wallet required).

## Live wallet integration

Connects via `@solana/wallet-adapter-react`. "Send SOL" and "Approve
token delegate" build real transactions against a live RPC connection;
signing goes through the same firewall and inspection panel as the
offline demos, then broadcasts via `connection.sendRawTransaction`.

Locked to devnet: `MAINNET_ENABLED = false` in `src/live/network.ts`.
This is enforced in `endpointFor()` (refuses to resolve a mainnet
endpoint), `LiveProviders`'s `setNetwork` (no-op for `mainnet-beta`), and
the UI (no network toggle rendered, Jupiter swap card disabled). Get
devnet SOL from https://faucet.solana.com.

Env vars (`.env`, see `.env.example`):

| Variable | Effect |
|---|---|
| `VITE_NETWORK` | No effect while `MAINNET_ENABLED` is `false`. |
| `VITE_RPC_ENDPOINT` | Mainnet RPC endpoint. No effect while `MAINNET_ENABLED` is `false`. |
| `VITE_DEVNET_RPC_ENDPOINT` | Optional devnet RPC endpoint. Falls back to the public `clusterApiUrl('devnet')` if unset. |

## Limitations

- Decoder coverage is intentionally small: System Program and SPL
  Token/Token-2022 are fully decoded. Jupiter is decoded as opaque
  (labeled, not guessed) since its instructions are Anchor-encoded and
  CPI into routes chosen at execution time.
- PDA detection uses the standard on-curve heuristic; it does not verify
  derivation from a specific seed set.
- `VersionedTransaction`s using address lookup tables are decoded as far
  as the static accounts allow; unresolved lookup-table accounts are
  flagged as a lower bound, not silently ignored.
- This inspects and decodes; it does not simulate. Effects that only
  appear from `simulateTransaction` (e.g. slippage) are not caught.
- `LiveConsole` uses web3.js's simpler `confirmTransaction(signature,
  commitment)` overload rather than the blockhash-based strategy.
- If a wallet extension's own network setting doesn't match (e.g. set to
  Mainnet while this app targets devnet), signing can fail with a
  `WalletNotConnectedError` even though the wallet shows connected.

## License

MIT — see `LICENSE`.
