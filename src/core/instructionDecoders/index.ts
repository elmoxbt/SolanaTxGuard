import { TransactionInstruction } from "@solana/web3.js";
import { DecodedInstruction } from "../types";
import { decodeSystemInstruction } from "./systemProgram";
import { decodeTokenInstruction } from "./splToken";
import { decodeJupiterInstruction } from "./jupiter";
import { decodeGenericInstruction } from "./generic";
import {
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  JUPITER_V6_PROGRAM_ID,
  JUPITER_V4_PROGRAM_ID
} from "../constants";

const SYSTEM_PROGRAM = SYSTEM_PROGRAM_ID.toBase58();
const TOKEN_PROGRAM = TOKEN_PROGRAM_ID.toBase58();
const TOKEN_2022_PROGRAM = TOKEN_2022_PROGRAM_ID.toBase58();
const JUPITER_V6 = JUPITER_V6_PROGRAM_ID.toBase58();
const JUPITER_V4 = JUPITER_V4_PROGRAM_ID.toBase58();

export function decodeInstruction(ix: TransactionInstruction, feePayer?: string): DecodedInstruction {
  const programId = ix.programId.toBase58();

  switch (programId) {
    case SYSTEM_PROGRAM:
      return decodeSystemInstruction(ix, feePayer);
    case TOKEN_PROGRAM:
    case TOKEN_2022_PROGRAM:
      return decodeTokenInstruction(ix, feePayer);
    case JUPITER_V6:
    case JUPITER_V4:
      return decodeJupiterInstruction(ix, feePayer);
    default:
      return decodeGenericInstruction(ix, feePayer);
  }
}

export * from "./shared";
