import { TransactionInstruction } from "@solana/web3.js";
import { DecodedInstruction, TransactionEffect } from "../types";
import { buildAccountRoles } from "./shared";
import { lookupProgram } from "../programRegistry";

/**
 * We don't know this program's instruction layout at all. Rather than
 * guessing, we report exactly what's structurally true: which accounts
 * are writable, which are signers, and which are PDAs the program could
 * be about to claim authority over. This is the "unknown program" /
 * "suspicious PDA" surface the risk engine reads from.
 */
export function decodeGenericInstruction(ix: TransactionInstruction, feePayer?: string): DecodedInstruction {
  const programId = ix.programId.toBase58();
  const programInfo = lookupProgram(programId);
  const accounts = buildAccountRoles(ix.keys, feePayer);
  const effects: TransactionEffect[] = [];

  const writableUserAccounts = accounts.filter((a) => a.isWritable && !a.isPDA);
  if (writableUserAccounts.length > 0) {
    effects.push({
      id: `${programId}-writable`,
      severity: programInfo.known ? "info" : "warning",
      summary: `${writableUserAccounts.length} account${writableUserAccounts.length > 1 ? "s" : ""} will be modified by ${programInfo.name}`
    });
  }

  return {
    programId,
    programName: programInfo.name,
    instructionName: programInfo.known ? "Program instruction" : "Unrecognized instruction",
    accounts,
    opaque: true,
    effects
  };
}
