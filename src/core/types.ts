/**
 * Core types shared across the decoder, risk engine, and UI.
 */

export type Severity = "info" | "warning" | "danger";

export interface ProgramInfo {
  address: string;
  name: string;
  category: "system" | "token" | "dex" | "compute" | "memo" | "unknown";
  /** Programs we ship a decoder for. Anything else is treated as opaque. */
  known: boolean;
}

export interface AccountRole {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
  /** True if the address is off-curve, i.e. it cannot hold a private key. */
  isPDA: boolean;
  /** Human label when we can infer one, e.g. "fee payer", "token account". */
  label?: string;
}

/**
 * One line item under "Potential effects" — a plain-language description
 * of something the transaction will actually do to the user's assets
 * or permissions.
 */
export interface TransactionEffect {
  id: string;
  severity: Severity;
  summary: string;
  detail?: string;
}

export interface RiskFlag {
  id: string;
  label: string;
  severity: Severity;
  /** Number of instructions/accounts that triggered this flag. */
  count: number;
  explanation: string;
}

export interface DecodedInstruction {
  programId: string;
  programName: string;
  /** Best-effort human name for the instruction, e.g. "Approve", "Transfer". */
  instructionName: string;
  accounts: AccountRole[];
  /** True when we could not decode the instruction body itself (still know program + accounts). */
  opaque: boolean;
  effects: TransactionEffect[];
}

export interface InspectionResult {
  /** Distinct programs invoked, in call order, de-duplicated by address. */
  programs: ProgramInfo[];
  instructions: DecodedInstruction[];
  effects: TransactionEffect[];
  riskFlags: RiskFlag[];
  /** Overall severity = the worst severity among all risk flags with count > 0. */
  overallSeverity: Severity;
  feePayer?: string;
}
