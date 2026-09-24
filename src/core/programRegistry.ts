import { ProgramInfo } from "./types";

/**
 * A small, explicit allow-list of well-known program IDs.
 *
 * This is intentionally NOT exhaustive. The firewall's safety model does not
 * depend on recognizing every program — it depends on correctly flagging
 * what it *cannot* recognize. Anything not listed here is treated as
 * "unknown" and surfaced to the user rather than silently trusted.
 */
export const KNOWN_PROGRAMS: Record<string, Omit<ProgramInfo, "address" | "known">> = {
  "11111111111111111111111111111111": {
    name: "System Program",
    category: "system"
  },
  ComputeBudget111111111111111111111111111111: {
    name: "Compute Budget",
    category: "compute"
  },
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: {
    name: "Memo Program",
    category: "memo"
  },
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: {
    name: "SPL Token",
    category: "token"
  },
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: {
    name: "SPL Token-2022",
    category: "token"
  },
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: {
    name: "Associated Token Account",
    category: "token"
  },
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: {
    name: "Jupiter Aggregator v6",
    category: "dex"
  },
  JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB: {
    name: "Jupiter Aggregator v4",
    category: "dex"
  }
};

export function lookupProgram(address: string): ProgramInfo {
  const entry = KNOWN_PROGRAMS[address];
  if (entry) {
    return { address, known: true, ...entry };
  }
  return {
    address,
    name: `Unknown program (${shorten(address)})`,
    category: "unknown",
    known: false
  };
}

export function shorten(address: string, size = 4): string {
  if (address.length <= size * 2 + 3) return address;
  return `${address.slice(0, size)}…${address.slice(-size)}`;
}
