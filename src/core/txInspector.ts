import {
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
  AccountMeta
} from "@solana/web3.js";
import { InspectionResult, ProgramInfo, TransactionEffect } from "./types";
import { decodeInstruction } from "./instructionDecoders";
import { lookupProgram } from "./programRegistry";
import { computeRiskFlags, worseOf } from "./riskEngine";

export type InspectableTransaction = Transaction | VersionedTransaction;

/**
 * Normalizes a legacy `Transaction` or a v0 `VersionedTransaction` into a
 * flat list of `TransactionInstruction`s plus a fee payer, so the rest of
 * the pipeline never has to care which shape it started as.
 *
 * VersionedTransactions that rely on address lookup tables cannot be fully
 * resolved offline (the lookup table contents live on-chain). When that
 * happens we decode what we can and the caller sees `truncated: true`.
 */
function normalize(tx: InspectableTransaction): {
  instructions: TransactionInstruction[];
  feePayer?: string;
  truncated: boolean;
} {
  if (tx instanceof Transaction) {
    return {
      instructions: tx.instructions,
      feePayer: tx.feePayer?.toBase58() ?? tx.instructions[0]?.keys.find((k) => k.isSigner)?.pubkey.toBase58(),
      truncated: false
    };
  }

  // VersionedTransaction
  const message = tx.message;

  try {
    const accountKeys = message.getAccountKeys(); // throws if lookup tables are required and not supplied
    const feePayer = accountKeys.get(0)?.toBase58();

    const instructions: TransactionInstruction[] = message.compiledInstructions.map((ci) => {
      const programId = accountKeys.get(ci.programIdIndex)!;
      const keys: AccountMeta[] = ci.accountKeyIndexes.map((idx) => {
        const pubkey = accountKeys.get(idx)!;
        return {
          pubkey,
          isSigner: message.isAccountSigner(idx),
          isWritable: message.isAccountWritable(idx)
        };
      });
      return new TransactionInstruction({
        programId,
        keys,
        data: Buffer.from(ci.data)
      });
    });

    return { instructions, feePayer, truncated: false };
  } catch {
    // Lookup tables present but not resolvable offline — decode the
    // static (non-lookup-table) accounts only, and flag it.
    const staticKeys = message.staticAccountKeys;
    const feePayer = staticKeys[0]?.toBase58();
    const instructions: TransactionInstruction[] = message.compiledInstructions
      .filter((ci) => ci.programIdIndex < staticKeys.length)
      .map((ci) => {
        const programId = staticKeys[ci.programIdIndex];
        const keys: AccountMeta[] = ci.accountKeyIndexes
          .filter((idx) => idx < staticKeys.length)
          .map((idx) => ({
            pubkey: staticKeys[idx],
            isSigner: message.isAccountSigner(idx),
            isWritable: message.isAccountWritable(idx)
          }));
        return new TransactionInstruction({ programId, keys, data: Buffer.from(ci.data) });
      });

    return { instructions, feePayer, truncated: true };
  }
}

export function inspectTransaction(tx: InspectableTransaction): InspectionResult {
  const { instructions: rawInstructions, feePayer, truncated } = normalize(tx);

  const knownSigners = new Set<string>(feePayer ? [feePayer] : []);
  const decoded = rawInstructions.map((ix) => decodeInstruction(ix, feePayer));

  const programMap = new Map<string, ProgramInfo>();
  const effects: TransactionEffect[] = [];

  for (const ix of decoded) {
    if (!programMap.has(ix.programId)) {
      programMap.set(ix.programId, lookupProgram(ix.programId));
    }
    effects.push(...ix.effects);
  }

  if (truncated) {
    effects.push({
      id: "truncated-lookup-table",
      severity: "warning",
      summary: "This transaction uses an address lookup table that couldn't be resolved offline",
      detail:
        "Some accounts referenced via the lookup table are not shown below. Treat this inspection as a lower bound, not a complete picture."
    });
  }

  const riskFlags = computeRiskFlags(decoded, feePayer, knownSigners);

  let overallSeverity: InspectionResult["overallSeverity"] = "info";
  for (const flag of riskFlags) {
    if (flag.count > 0) overallSeverity = worseOf(overallSeverity, flag.severity);
  }
  for (const effect of effects) {
    overallSeverity = worseOf(overallSeverity, effect.severity);
  }

  return {
    programs: Array.from(programMap.values()),
    instructions: decoded,
    effects,
    riskFlags,
    overallSeverity,
    feePayer
  };
}
