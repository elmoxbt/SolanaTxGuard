import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "../constants";

/**
 * Builds a legacy (non-Checked) SPL Token `Approve` instruction.
 *
 * This is the instruction the firewall exists to catch: it hands a
 * delegate standing permission to move up to `rawAmount` of the token
 * held in `source`, without any further signature from the owner, until
 * explicitly revoked.
 */
export function buildApproveInstruction(
  source: PublicKey,
  delegate: PublicKey,
  owner: PublicKey,
  rawAmount: bigint,
  programId: PublicKey = TOKEN_PROGRAM_ID
): TransactionInstruction {
  const data = Buffer.alloc(9);
  data.writeUInt8(4, 0); // Approve discriminant
  data.writeBigUInt64LE(rawAmount, 1);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: delegate, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false }
    ],
    data
  });
}

/** Builds an SPL Token `Revoke` instruction — clears any delegate on `source`. */
export function buildRevokeInstruction(
  source: PublicKey,
  owner: PublicKey,
  programId: PublicKey = TOKEN_PROGRAM_ID
): TransactionInstruction {
  const data = Buffer.from([5]); // Revoke discriminant
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false }
    ],
    data
  });
}
