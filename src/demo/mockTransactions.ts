import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, JUPITER_V6_PROGRAM_ID } from "../core/constants";
import { buildApproveInstruction } from "../core/instructionBuilders/splToken";

// A deliberately unregistered program id, to demonstrate the "unknown program" path.
const MYSTERY_PROGRAM = new PublicKey("MystzGqM6TTS9CBEbSFEZFQVzYVCCyfZ6zh6HTn3T4T");

/**
 * Matches the exact scenario in the project brief: a Jupiter swap that
 * bundles a SOL transfer with a token approval. This is the canonical
 * "looks routine, isn't" transaction — the swap is legitimate, but it
 * quietly asks for standing delegate authority too.
 */
export function buildJupiterSwapWithApproval() {
  const wallet = Keypair.generate().publicKey;
  const recipient = Keypair.generate().publicKey;
  const sourceTokenAccount = Keypair.generate().publicKey;
  const delegate = Keypair.generate().publicKey;
  const jupiterScratchAccount = Keypair.generate().publicKey;

  const tx = new Transaction();
  tx.feePayer = wallet;

  tx.add(
    SystemProgram.transfer({
      fromPubkey: wallet,
      toPubkey: recipient,
      lamports: 0.43 * 1_000_000_000
    })
  );

  tx.add(buildApproveInstruction(sourceTokenAccount, delegate, wallet, 50_000_000n));

  tx.add(
    new TransactionInstruction({
      programId: JUPITER_V6_PROGRAM_ID,
      keys: [
        { pubkey: wallet, isSigner: true, isWritable: false },
        { pubkey: sourceTokenAccount, isSigner: false, isWritable: true },
        { pubkey: jupiterScratchAccount, isSigner: false, isWritable: true }
      ],
      data: Buffer.from([0xe4, 0x17, 0x9c, 0x1b, 0x00, 0x00, 0x00, 0x00])
    })
  );

  return { label: "Jupiter swap + token approval", tx };
}

/** A plain SOL transfer — nothing to flag. */
export function buildSimpleTransfer() {
  const wallet = Keypair.generate().publicKey;
  const recipient = Keypair.generate().publicKey;

  const tx = new Transaction();
  tx.feePayer = wallet;
  tx.add(
    SystemProgram.transfer({
      fromPubkey: wallet,
      toPubkey: recipient,
      lamports: 0.05 * 1_000_000_000
    })
  );

  return { label: "Plain SOL transfer", tx };
}

/**
 * An unrecognized program taking a writable PDA and a second signer —
 * the pattern that should light up every flag at once.
 */
export function buildSuspiciousUnknownProgram() {
  const wallet = Keypair.generate().publicKey;
  const secondarySigner = Keypair.generate().publicKey;
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), wallet.toBuffer()], MYSTERY_PROGRAM);

  const tx = new Transaction();
  tx.feePayer = wallet;
  tx.add(
    new TransactionInstruction({
      programId: MYSTERY_PROGRAM,
      keys: [
        { pubkey: wallet, isSigner: true, isWritable: false },
        { pubkey: secondarySigner, isSigner: true, isWritable: false },
        { pubkey: pda, isSigner: false, isWritable: true }
      ],
      data: Buffer.from([0x01, 0x02, 0x03])
    })
  );

  return { label: "Unrecognized program + PDA authority", tx };
}
