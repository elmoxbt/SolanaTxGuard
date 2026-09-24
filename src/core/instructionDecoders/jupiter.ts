import { TransactionInstruction } from "@solana/web3.js";
import { DecodedInstruction, TransactionEffect } from "../types";
import { buildAccountRoles } from "./shared";
import { lookupProgram } from "../programRegistry";

/**
 * Jupiter's route/swap instructions are Anchor-encoded and, more
 * importantly, CPI into whichever underlying DEX program(s) the route
 * selects at execution time. We cannot statically know those inner
 * programs from the outer instruction alone (they depend on the route
 * plan), so we deliberately do NOT pretend to fully decode this — we
 * label it as a known aggregator call and surface the honest limitation
 * as an effect, rather than a false sense of certainty.
 */
export function decodeJupiterInstruction(ix: TransactionInstruction, feePayer?: string): DecodedInstruction {
  const programId = ix.programId.toBase58();
  const programInfo = lookupProgram(programId);
  const accounts = buildAccountRoles(ix.keys, feePayer);

  const effects: TransactionEffect[] = [
    {
      id: `${programId}-route`,
      severity: "info",
      summary: "Routing a token swap through Jupiter",
      detail:
        "Jupiter CPIs into one or more underlying DEX/AMM programs chosen at execution time. Those inner calls are not visible from this instruction alone — check the SPL Token instructions in this transaction for the actual amounts and token accounts that move."
    }
  ];

  const writablePDAs = accounts.filter((a) => a.isPDA && a.isWritable && !a.isSigner);
  if (writablePDAs.length > 0) {
    effects.push({
      id: `${programId}-pda-authority`,
      severity: "warning",
      summary: `${writablePDAs.length} program-controlled account${writablePDAs.length > 1 ? "s" : ""} will be written to`,
      detail: writablePDAs.map((a) => a.pubkey).join(", ")
    });
  }

  return {
    programId,
    programName: programInfo.name,
    instructionName: "Token swap (route)",
    accounts,
    opaque: true,
    effects
  };
}
