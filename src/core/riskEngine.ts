import { DecodedInstruction, RiskFlag, Severity } from "./types";

const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, danger: 2 };

export function worseOf(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/**
 * Every flag here corresponds to a *structural* fact about the
 * transaction — something we can prove from accounts/instructions,
 * not a guess about intent. That's what makes the counts trustworthy:
 * [1] Token approval means "exactly one Approve-family instruction was
 * found", not "this transaction seems risky".
 */
export function computeRiskFlags(
  instructions: DecodedInstruction[],
  feePayer: string | undefined,
  knownSigners: Set<string>
): RiskFlag[] {
  let tokenApprovalCount = 0;
  let unknownSignerCount = 0;
  let suspiciousPdaCount = 0;
  let unknownProgramCount = 0;

  const seenSigners = new Set<string>(feePayer ? [feePayer] : []);
  const flaggedSigners = new Set<string>();
  const flaggedPdas = new Set<string>();
  const flaggedPrograms = new Set<string>();

  for (const ix of instructions) {
    const isApprovalInstruction = /approve|set authority/i.test(ix.instructionName);
    if (isApprovalInstruction) tokenApprovalCount += 1;

    if (ix.opaque && ix.programName.startsWith("Unknown program")) {
      if (!flaggedPrograms.has(ix.programId)) {
        flaggedPrograms.add(ix.programId);
        unknownProgramCount += 1;
      }
    }

    for (const account of ix.accounts) {
      if (account.isSigner && !seenSigners.has(account.pubkey) && !knownSigners.has(account.pubkey)) {
        if (!flaggedSigners.has(account.pubkey)) {
          flaggedSigners.add(account.pubkey);
          unknownSignerCount += 1;
        }
      }

      // A PDA becoming writable+authority-bearing under a program we don't
      // recognize is exactly the "controlled authority over assets/state"
      // pattern this tool exists to surface.
      if (account.isPDA && account.isWritable && !flaggedPdas.has(account.pubkey)) {
        const programIsUnknown = ix.programName.startsWith("Unknown program");
        if (programIsUnknown) {
          flaggedPdas.add(account.pubkey);
          suspiciousPdaCount += 1;
        }
      }
    }
  }

  const flags: RiskFlag[] = [
    {
      id: "token-approval",
      label: "Token approval",
      severity: "danger",
      count: tokenApprovalCount,
      explanation:
        "A delegate (often a program) is being given permission to move tokens on your behalf without a fresh signature each time, until you revoke it."
    },
    {
      id: "unknown-signer",
      label: "Unknown signer",
      severity: "warning",
      count: unknownSignerCount,
      explanation:
        "An account other than your wallet is signing this transaction. Confirm you recognize it — a second signer can co-authorize actions you didn't initiate."
    },
    {
      id: "suspicious-pda",
      label: "Suspicious PDA",
      severity: "warning",
      count: suspiciousPdaCount,
      explanation:
        "A program-derived address controlled by an unrecognized program is being written to. PDAs can hold delegated authority over your assets or state."
    },
    {
      id: "unknown-program",
      label: "Unrecognized program",
      severity: "info",
      count: unknownProgramCount,
      explanation: "This transaction invokes a program that isn't in the firewall's known-program registry."
    }
  ];

  return flags;
}
