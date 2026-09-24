import { TransactionInstruction } from "@solana/web3.js";
import { DecodedInstruction, TransactionEffect } from "../types";
import { buildAccountRoles } from "./shared";
import { lookupProgram } from "../programRegistry";

/**
 * Discriminant byte -> instruction name, per the legacy (non-Anchor) SPL
 * Token program layout. Token-2022 is a superset of this layout for the
 * instructions we care about here.
 *
 * We only implement full field decoding for the instructions that actually
 * change *who controls funds* (Approve/Revoke/SetAuthority) or *move
 * value* (Transfer/TransferChecked/Burn/MintTo/CloseAccount) — the ones
 * the firewall exists to catch. Everything else is labeled but left opaque.
 */
const TOKEN_INSTRUCTION_NAMES: Record<number, string> = {
  0: "Initialize Mint",
  1: "Initialize Account",
  2: "Initialize Multisig",
  3: "Transfer",
  4: "Approve",
  5: "Revoke",
  6: "Set Authority",
  7: "Mint To",
  8: "Burn",
  9: "Close Account",
  10: "Freeze Account",
  11: "Thaw Account",
  12: "Transfer Checked",
  13: "Approve Checked",
  14: "Mint To Checked",
  15: "Burn Checked",
  18: "Initialize Account 3",
  19: "Sync Native"
};

const AUTHORITY_TYPE_NAMES: Record<number, string> = {
  0: "mint authority",
  1: "freeze authority",
  2: "account owner",
  3: "close authority"
};

function readU64LE(data: Buffer, offset: number): bigint {
  return data.readBigUInt64LE(offset);
}

export function decodeTokenInstruction(ix: TransactionInstruction, feePayer?: string): DecodedInstruction {
  const programId = ix.programId.toBase58();
  const programInfo = lookupProgram(programId);
  const accounts = buildAccountRoles(ix.keys, feePayer);
  const data = ix.data;
  const effects: TransactionEffect[] = [];

  if (data.length === 0) {
    return {
      programId,
      programName: programInfo.name,
      instructionName: "Empty instruction",
      accounts,
      opaque: true,
      effects
    };
  }

  const discriminant = data[0];
  const name = TOKEN_INSTRUCTION_NAMES[discriminant] ?? `Unrecognized (opcode ${discriminant})`;
  let opaque = !(discriminant in TOKEN_INSTRUCTION_NAMES);

  try {
    switch (discriminant) {
      case 3: {
        // Transfer(amount: u64) — [source, destination, authority]
        const amount = readU64LE(data, 1);
        const [source, destination] = accounts;
        effects.push({
          id: `${programId}-transfer-${source?.pubkey}`,
          severity: "warning",
          summary: `Transferring ${amount.toString()} raw token units`,
          detail: `From token account ${source?.pubkey} to ${destination?.pubkey}`
        });
        break;
      }
      case 4: {
        // Approve(amount: u64) — [source, delegate, owner]
        const amount = readU64LE(data, 1);
        const [source, delegate] = accounts;
        const delegateIsPDA = delegate?.isPDA;
        effects.push({
          id: `${programId}-approve-${source?.pubkey}`,
          severity: "danger",
          summary: `Giving ${delegateIsPDA ? "a program" : "an account"} delegate authority over token account ${short(
            source?.pubkey
          )}`,
          detail: `Delegate ${delegate?.pubkey} may move up to ${amount.toString()} raw units without further approval, until revoked.`
        });
        break;
      }
      case 5: {
        // Revoke — [source, owner]
        const [source] = accounts;
        effects.push({
          id: `${programId}-revoke-${source?.pubkey}`,
          severity: "info",
          summary: `Revoking any existing delegate on token account ${short(source?.pubkey)}`
        });
        break;
      }
      case 6: {
        // SetAuthority(authorityType: u8, newAuthorityOption: u8, newAuthority?: pubkey)
        const authorityType = data[1];
        const hasNew = data[2] === 1;
        const authorityLabel = AUTHORITY_TYPE_NAMES[authorityType] ?? `authority type ${authorityType}`;
        const [account] = accounts;
        effects.push({
          id: `${programId}-setauth-${account?.pubkey}`,
          severity: "danger",
          summary: hasNew
            ? `Changing the ${authorityLabel} on ${short(account?.pubkey)} to a new account`
            : `Removing the ${authorityLabel} on ${short(account?.pubkey)}`
        });
        break;
      }
      case 7: {
        // MintTo(amount: u64)
        const amount = readU64LE(data, 1);
        const [mint, destination] = accounts;
        effects.push({
          id: `${programId}-mintto-${mint?.pubkey}`,
          severity: "warning",
          summary: `Minting ${amount.toString()} raw units of ${short(mint?.pubkey)} into ${short(destination?.pubkey)}`
        });
        break;
      }
      case 8: {
        // Burn(amount: u64)
        const amount = readU64LE(data, 1);
        const [source] = accounts;
        effects.push({
          id: `${programId}-burn-${source?.pubkey}`,
          severity: "warning",
          summary: `Burning ${amount.toString()} raw units from ${short(source?.pubkey)}`
        });
        break;
      }
      case 9: {
        // CloseAccount — [account, destination, owner]
        const [account, destination] = accounts;
        effects.push({
          id: `${programId}-close-${account?.pubkey}`,
          severity: "warning",
          summary: `Closing token account ${short(account?.pubkey)}`,
          detail: `Remaining rent-exempt SOL balance goes to ${destination?.pubkey}`
        });
        break;
      }
      case 12: {
        // TransferChecked(amount: u64, decimals: u8) — [source, mint, destination, authority]
        const amount = readU64LE(data, 1);
        const decimals = data[9];
        const [source, mint, destination] = accounts;
        const display = Number(amount) / 10 ** decimals;
        effects.push({
          id: `${programId}-transferchecked-${source?.pubkey}`,
          severity: "warning",
          summary: `Transferring ${display} tokens (${short(mint?.pubkey)})`,
          detail: `From ${source?.pubkey} to ${destination?.pubkey}`
        });
        break;
      }
      case 13: {
        // ApproveChecked(amount: u64, decimals: u8) — [source, mint, delegate, owner]
        const amount = readU64LE(data, 1);
        const decimals = data[9];
        const [source, mint, delegate] = accounts;
        const display = Number(amount) / 10 ** decimals;
        effects.push({
          id: `${programId}-approvechecked-${source?.pubkey}`,
          severity: "danger",
          summary: `Giving ${delegate?.isPDA ? "a program" : "an account"} delegate authority over up to ${display} tokens (${short(
            mint?.pubkey
          )})`,
          detail: `Delegate ${delegate?.pubkey} on token account ${source?.pubkey}, until revoked.`
        });
        break;
      }
      default: {
        opaque = true;
      }
    }
  } catch {
    opaque = true;
  }

  return {
    programId,
    programName: programInfo.name,
    instructionName: name,
    accounts,
    opaque,
    effects
  };
}

function short(address?: string): string {
  if (!address) return "an account";
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
