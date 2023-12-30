import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { OrdoBrc } from "../target/types/ordo_brc";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram, sendAndConfirmRawTransaction, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { BN } from "bn.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as pdas from './utils/pdas'
import { RENT_PROGRAM_ID, SYSTEM_PROGRAM_ID } from "@raydium-io/raydium-sdk";
import { assert } from "console";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { Metaplex, USD, keypairIdentity, toMetaplexFile } from "@metaplex-foundation/js";
import * as other from './utils/other'
import fs from "fs";
import { generateRandomUppercaseString, increaseTransactionBudget } from './utils/other';

describe("add user pending claims", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.OrdoBrc as Program<OrdoBrc>;
    const fileSystemWallet = anchor.getProvider();

    //const configPda = pdas.getConfig(program.programId);
    const globalStatePda = pdas.getGlobalState(program.programId);
    const metaplexMetadataProgram = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')

    it("creates a wrapped entry (mint account ,state and sets authorities) and then adds a user's pending claim entry in the same transaction", async () => {
        const ticker = generateRandomUppercaseString()
        const decimals = 6;
        const uri = 'https://b5nxubtqmkzyk4ly2gyfg75knezec2holjju4zy2z2spn7w7xiva.arweave.net/D1t6BnBis4VxeNGwU3-qaTJBaO5aU05nGs6k9v7fuio'
        const maxSupply = new BN(696969);

        const wrappedMintPda = pdas.getWrappedMint(program.programId, ticker);
        const wrappedMetadataPda = pdas.getMetadataPda(wrappedMintPda);
        const wrappedStatePda = pdas.getWrappedState(program.programId, ticker);
        const userAccountPda = pdas.getUserAccount(program.programId, fileSystemWallet.publicKey);

        const inst1 = await program.methods.createWrappedEntry({
            ticker: ticker,
            decimals: decimals,
            uri: uri,
            maxSupply: maxSupply,
        })
            .accounts({
                globalStateAccount: globalStatePda,
                wrappedMintAccount: wrappedMintPda,
                wrappedMetadataAccount: wrappedMetadataPda,
                wrappedStateAccount: wrappedStatePda,
                signer: fileSystemWallet.publicKey,
                systemProgram: SYSTEM_PROGRAM_ID,
                rent: SYSVAR_RENT_PUBKEY,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenMetadataProgram: metaplexMetadataProgram,
            }).instruction();


        const inst2 = await program.methods.addUserPendingClaim({
            solAddress: fileSystemWallet.publicKey,
            ticker: ticker,
            amount: new BN(1000),
        })
            .accounts({
                globalStateAccount: globalStatePda,
                wrappedMintAccount: wrappedMintPda,
                wrappedStateAccount: wrappedStatePda,
                userAccount: userAccountPda,
                signer: fileSystemWallet.publicKey,
                systemProgram: SYSTEM_PROGRAM_ID,
                rent: SYSVAR_RENT_PUBKEY,
            }).instruction();

        const tx = new Transaction().add(inst1).add(inst2);
        increaseTransactionBudget(tx, 500000);
        await other.hydrateTransaction(tx, fileSystemWallet.connection, fileSystemWallet.publicKey);
        const sig = await fileSystemWallet.sendAndConfirm(tx, [], { skipPreflight: true });
        console.log('wrapped token initialization successfull, tx sig:' + sig);

        const userData = await program.account.userAccount.fetch(userAccountPda);
        userData.pendingClaims.map(e => console.log(e.ticker, e.amount));

        //console.log(`Transaction Sig: ${sig}`)
        //const wrappedStateData = await program.account.wrappedStateAccount.fetch(wrappedStatePda)
        //console.log(wrappedStateData)
    });

    it.skip("creates a wrapped entry (mint account ,state and sets authorities) and then adds a user's pending claim entry 3 times in the same transaction", async () => {
        const ticker = generateRandomUppercaseString()
        const decimals = 6;
        const uri = 'https://b5nxubtqmkzyk4ly2gyfg75knezec2holjju4zy2z2spn7w7xiva.arweave.net/D1t6BnBis4VxeNGwU3-qaTJBaO5aU05nGs6k9v7fuio'
        const maxSupply = new BN(696969);

        const wrappedMintPda = pdas.getWrappedMint(program.programId, ticker);
        const wrappedMetadataPda = pdas.getMetadataPda(wrappedMintPda);
        const wrappedStatePda = pdas.getWrappedState(program.programId, ticker);
        const userAccountPda = pdas.getUserAccount(program.programId, fileSystemWallet.publicKey);

        const inst1 = await program.methods.createWrappedEntry({
            ticker: ticker,
            decimals: decimals,
            uri: uri,
            maxSupply: maxSupply,
        })
            .accounts({
                globalStateAccount: globalStatePda,
                wrappedMintAccount: wrappedMintPda,
                wrappedMetadataAccount: wrappedMetadataPda,
                wrappedStateAccount: wrappedStatePda,
                signer: fileSystemWallet.publicKey,
                systemProgram: SYSTEM_PROGRAM_ID,
                rent: SYSVAR_RENT_PUBKEY,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenMetadataProgram: metaplexMetadataProgram,
            }).instruction();

        const tx = new Transaction().add(inst1)


        for (let i = 0; i < 3; i++) {
            const pendingClaimIx = await program.methods.addUserPendingClaim({
                solAddress: fileSystemWallet.publicKey,
                ticker: ticker,
                amount: new BN(1000* (i+1)),
            })
                .accounts({
                    globalStateAccount: globalStatePda,
                    wrappedMintAccount: wrappedMintPda,
                    wrappedStateAccount: wrappedStatePda,
                    userAccount: userAccountPda,
                    signer: fileSystemWallet.publicKey,
                    systemProgram: SYSTEM_PROGRAM_ID,
                    rent: SYSVAR_RENT_PUBKEY,
                }).instruction();

            tx.add(pendingClaimIx);
        }

        increaseTransactionBudget(tx, 800000);
        await other.hydrateTransaction(tx, fileSystemWallet.connection, fileSystemWallet.publicKey);
        const sig = await fileSystemWallet.sendAndConfirm(tx, [], { skipPreflight: true });
        console.log('wrapped token initialization successfull, tx sig:' + sig);

        const userData = await program.account.userAccount.fetch(userAccountPda);
        userData.pendingClaims.map(e => console.log(e.ticker, e.amount.toNumber()));

        //console.log(`Transaction Sig: ${sig}`)
        //const wrappedStateData = await program.account.wrappedStateAccount.fetch(wrappedStatePda)
        //console.log(wrappedStateData)
    });
});
