import { SystemInstruction, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { DecodedInstruction, TransactionEffect } from "../types";
import { buildAccountRoles } from "./shared";

const LAMPORTS_PER_SOL = 1_000_000_000;

function fmtSol(lamports: number | bigint): string {
  const n = typeof lamports === "bigint" ? Number(lamports) : lamports;
  return (n / LAMPORTS_PER_SOL).toFixed(n % LAMPORTS_PER_SOL === 0 ? 2 : 4);
}

export function decodeSystemInstruction(
  ix: TransactionInstruction,
  feePayer?: string
): DecodedInstruction {
  const accounts = buildAccountRoles(ix.keys, feePayer);
  const effects: TransactionEffect[] = [];
  let name = "Unknown System instruction";
  let opaque = false;

  let type: ReturnType<typeof SystemInstruction.decodeInstructionType> | undefined;
  try {
    type = SystemInstruction.decodeInstructionType(ix);
  } catch {
    opaque = true;
  }

  try {
    switch (type) {
      case "Transfer": {
        const decoded = SystemInstruction.decodeTransfer(ix);
        name = "Transfer SOL";
        effects.push({
          id: `${ix.programId.toBase58()}-transfer`,
          severity: "warning",
          summary: `Spending ${fmtSol(decoded.lamports)} SOL`,
          detail: `From ${decoded.fromPubkey.toBase58()} to ${decoded.toPubkey.toBase58()}`
        });
        break;
      }
      case "Create": {
        const decoded = SystemInstruction.decodeCreateAccount(ix);
        name = "Create Account";
        effects.push({
          id: `${ix.programId.toBase58()}-create`,
          severity: "info",
          summary: `Creating a new account funded with ${fmtSol(decoded.lamports)} SOL`,
          detail: `Owned by program ${decoded.programId.toBase58()}`
        });
        break;
      }
      case "Allocate": {
        name = "Allocate Space";
        effects.push({
          id: `${ix.programId.toBase58()}-allocate`,
          severity: "info",
          summary: "Allocating storage space for an account"
        });
        break;
      }
      case "Assign": {
        const decoded = SystemInstruction.decodeAssign(ix);
        name = "Assign Owner";
        effects.push({
          id: `${ix.programId.toBase58()}-assign`,
          severity: "warning",
          summary: `Reassigning account ownership to ${decoded.programId.toBase58()}`
        });
        break;
      }
      default: {
        opaque = true;
        name = "System instruction (unrecognized variant)";
      }
    }
  } catch {
    opaque = true;
  }

  return {
    programId: SystemProgram.programId.toBase58(),
    programName: "System Program",
    instructionName: name,
    accounts,
    opaque,
    effects
  };
}
