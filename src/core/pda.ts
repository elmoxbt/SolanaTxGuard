import { PublicKey } from "@solana/web3.js";

/**
 * A Program Derived Address is, by construction, pushed off the ed25519
 * curve so that no private key exists for it. `PublicKey.isOnCurve` is the
 * standard heuristic web3.js exposes for this: if an address is off-curve,
 * it is (almost certainly) a PDA rather than a wallet.
 *
 * This matters for the firewall because PDAs are how a program is granted
 * "controlled authority" over accounts — a PDA can be set as the owner or
 * delegate of a token account, and from that point on the *program's*
 * on-chain logic decides what happens to those funds, not the user's
 * wallet signature alone.
 */
export function isPDA(address: string): boolean {
  try {
    const key = new PublicKey(address);
    return !PublicKey.isOnCurve(key.toBytes());
  } catch {
    // Not a valid ed25519-length address at all — treat conservatively.
    return false;
  }
}

/**
 * Best-effort derivation check: does `candidate` derive from `programId`
 * under *some* seed set we were given? We can't brute-force seeds we don't
 * know, so this is only usable when the caller supplies expected seeds
 * (e.g. the well-known ATA derivation). For the general case we fall back
 * to the on-curve heuristic in `isPDA`.
 */
export function isDerivedFrom(
  candidate: string,
  programId: string,
  seeds: (Buffer | Uint8Array)[]
): boolean {
  try {
    const [derived] = PublicKey.findProgramAddressSync(seeds, new PublicKey(programId));
    return derived.toBase58() === candidate;
  } catch {
    return false;
  }
}
