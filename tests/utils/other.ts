
import { Connection, LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { ComputeBudgetProgram } from "@solana/web3.js";

//funding new wallet with devnet sol for testing
export async function fundWallet(newWallet: PublicKey, funder:anchor.Provider, amount:number){
    const tx_inst = anchor.web3.SystemProgram.transfer(
        {
            fromPubkey: funder.publicKey,
            toPubkey:newWallet,
            lamports: LAMPORTS_PER_SOL * amount
        }
    )
    const transaction = new anchor.web3.Transaction().add(
        tx_inst
    )
    await funder.sendAndConfirm(transaction);
}

export async function hydrateTransaction(tx: Transaction, connection: Connection, feePayer: PublicKey) {
    const hash = await connection.getLatestBlockhashAndContext()
    const recentBlockhash = hash.value.blockhash;
    const lastValidBlockHeight = hash.value.lastValidBlockHeight;
  
    tx.recentBlockhash = recentBlockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = new PublicKey(feePayer);
}

export function increaseTransactionBudget(tx:Transaction, newBudget:number):Transaction{
    const newTx = new Transaction();
    newTx.add(
        ComputeBudgetProgram.setComputeUnitLimit({units:newBudget})
    )
    newTx.add(
        ...tx.instructions
    )
    return newTx
} 

export function generateRandomUppercaseString(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 4; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }
    return result;
}

export function generateRandomDecimal(): number {
    const randomFloat = Math.random();
    const randomNumber = Math.floor(randomFloat * 10);
    return randomNumber;
  }