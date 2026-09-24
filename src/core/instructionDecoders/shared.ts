import { AccountMeta } from "@solana/web3.js";
import { AccountRole } from "../types";
import { isPDA } from "../pda";

export function buildAccountRoles(keys: AccountMeta[], feePayer?: string): AccountRole[] {
  return keys.map((k) => {
    const pubkey = k.pubkey.toBase58();
    return {
      pubkey,
      isSigner: k.isSigner,
      isWritable: k.isWritable,
      isPDA: isPDA(pubkey),
      label: feePayer && pubkey === feePayer ? "fee payer" : undefined
    };
  });
}
