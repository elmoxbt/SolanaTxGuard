import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "../core/constants";
import { buildApproveInstruction } from "../core/instructionBuilders/splToken";

export interface OwnedTokenAccount {
  pubkey: string;
  mint: string;
  uiAmount: string;
  decimals: number;
}

/** A real, unsigned SOL transfer against a live blockhash. */
export async function buildSendSolTx(
  connection: Connection,
  from: PublicKey,
  toAddress: string,
  solAmount: number
): Promise<Transaction> {
  const to = new PublicKey(toAddress); // throws on malformed input — surfaced to the caller
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction();
  tx.feePayer = from;
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.add(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports: Math.round(solAmount * LAMPORTS_PER_SOL)
    })
  );
  return tx;
}

/** The connected wallet's real SPL Token / Token-2022 accounts, for picking one to approve a delegate on. */
export async function fetchOwnedTokenAccounts(connection: Connection, owner: PublicKey): Promise<OwnedTokenAccount[]> {
  const [legacy, token2022] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID })
  ]);

  return [...legacy.value, ...token2022.value]
    .map(({ pubkey, account }) => {
      const info = account.data.parsed.info;
      return {
        pubkey: pubkey.toBase58(),
        mint: info.mint as string,
        uiAmount: info.tokenAmount.uiAmountString as string,
        decimals: info.tokenAmount.decimals as number
      };
    })
    .filter((a) => Number(a.uiAmount) > 0);
}

/** A real, unsigned `Approve` — the exact "giving a delegate authority" scenario, built from a live token account. */
export async function buildApproveTx(
  connection: Connection,
  owner: PublicKey,
  tokenAccount: string,
  delegate: string,
  rawAmount: bigint,
  programId: PublicKey = TOKEN_PROGRAM_ID
): Promise<Transaction> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction();
  tx.feePayer = owner;
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.add(buildApproveInstruction(new PublicKey(tokenAccount), new PublicKey(delegate), owner, rawAmount, programId));
  return tx;
}

export interface JupiterSwapParams {
  inputMint: string;
  outputMint: string;
  /** Raw base-unit amount (already multiplied by the input mint's decimals), as a string. */
  amount: string;
  slippageBps?: number;
}

/**
 * Fetches a real route from Jupiter's public quote API and asks Jupiter to
 * build the matching swap transaction for `owner`. Jupiter only routes
 * real liquidity, which only exists on mainnet-beta — there is no devnet
 * equivalent, so this is gated to mainnet in the UI.
 *
 * The returned transaction is unsigned. Nothing about calling this
 * function spends anything; only actually signing and broadcasting it
 * does.
 */
export async function buildJupiterSwapTx(owner: PublicKey, params: JupiterSwapParams): Promise<VersionedTransaction> {
  const quoteUrl = new URL("https://quote-api.jup.ag/v6/quote");
  quoteUrl.searchParams.set("inputMint", params.inputMint);
  quoteUrl.searchParams.set("outputMint", params.outputMint);
  quoteUrl.searchParams.set("amount", params.amount);
  quoteUrl.searchParams.set("slippageBps", String(params.slippageBps ?? 50));

  const quoteRes = await fetch(quoteUrl.toString());
  if (!quoteRes.ok) {
    throw new Error(`Jupiter quote failed (${quoteRes.status}). Check the mint addresses and amount.`);
  }
  const quoteResponse = await quoteRes.json();

  const swapRes = await fetch("https://quote-api.jup.ag/v6/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: owner.toBase58(),
      wrapAndUnwrapSol: true
    })
  });
  if (!swapRes.ok) {
    throw new Error(`Jupiter couldn't build the swap transaction (${swapRes.status}).`);
  }
  const { swapTransaction } = (await swapRes.json()) as { swapTransaction: string };

  return VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));
}
