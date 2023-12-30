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

    const configPda = pdas.getConfig(program.programId);
    const globalStatePda = pdas.getGlobalState(program.programId);
    const metaplexMetadataProgram = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')

    it("creates wrapped entry => adds user pending claim => user claims tokens => user burns tokens", async () => {
        const ticker = other.generateRandomUppercaseString()
        const decimals = other.generateRandomDecimal();
        const uri = 'https://b5nxubtqmkzyk4ly2gyfg75knezec2holjju4zy2z2spn7w7xiva.arweave.net/D1t6BnBis4VxeNGwU3-qaTJBaO5aU05nGs6k9v7fuio'
        const maxSupply = new BN(696969);

        const wrappedMintPda = pdas.getWrappedMint(program.programId, ticker);
        const wrappedMetadataPda = pdas.getMetadataPda(wrappedMintPda);
        const wrappedStatePda = pdas.getWrappedState(program.programId, ticker);
        const userAccountPda = pdas.getUserAccount(program.programId, fileSystemWallet.publicKey);
        const signerAta = getAssociatedTokenAddressSync(wrappedMintPda, fileSystemWallet.publicKey, true);
        const adminAta = getAssociatedTokenAddressSync(wrappedMintPda, fileSystemWallet.publicKey, true);

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
        console.log('wrapped token initialization successfull, tx sig:\n' + sig);

        console.log('user pending claim entry added!')
        console.log('new claims:\n')

        const userData = await program.account.userAccount.fetch(userAccountPda);
        console.log("entries: " + userData.pendingClaims.length);
        userData.pendingClaims.map(e => console.log('ticker: ' + e.ticker, 'amount: ' + e.amount.toNumber()));


        const claimSig = await program.methods.claimTokens({
            ticker: ticker,
            amount: new BN(1000),
        }).accounts({
            globalStateAccount: globalStatePda,
            configAccount: configPda,
            wrappedMintAccount: wrappedMintPda,
            wrappedStateAccount: wrappedStatePda,
            userAccount: userAccountPda,
            signerAta: signerAta,
            adminAta: adminAta,
            signer: fileSystemWallet.publicKey,
            admin: fileSystemWallet.publicKey,
            systemProgram: SYSTEM_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
        }).signers([])
            .rpc({ skipPreflight: true });

        console.log(`claimed pending claim for user with sig: ${claimSig}`)
        console.log("entries: " + userData.pendingClaims.length);
        const newUserData = await program.account.userAccount.fetch(userAccountPda);
        newUserData.pendingClaims.map(e => console.log('ticker: ' + e.ticker, 'amount: ' + e.amount.toNumber()));


        const burnSig = await program.methods.burnTokens({
            ticker: ticker,
            amount: new BN(1000),
            chain: 'AVAX',
            crossChainAddress: "0x3cA8ac240F6ebeA8684b3E629A8e8C1f0E3bC0Ff",
        }).accounts({
            globalStateAccount: globalStatePda,
            configAccount: configPda,
            wrappedMintAccount: wrappedMintPda,
            wrappedStateAccount: wrappedStatePda,
            userAccount: userAccountPda,
            signerAta: signerAta,
            signer: fileSystemWallet.publicKey,
            admin: fileSystemWallet.publicKey,
            systemProgram: SYSTEM_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
        }).signers([])
            .rpc({ skipPreflight: true });

        console.log(`burned tokens for user and added burn entry with sig: ${burnSig}`)
        const refreshedUserData = await program.account.userAccount.fetch(userAccountPda);
        console.log("burn entries: " + refreshedUserData.burnEntries.length);
        refreshedUserData.burnEntries.map(e => console.log('ticker: ' + e.ticker, 'amount: ' + e.amount.toNumber(), "chain: " + e.chain, "cross-chain-address: " + e.crossChainAddress));


        const redeemSig = await program.methods.redeemBurn({
            ticker: ticker,
            amount: new BN(1000),
            chain: 'AVAX',
        }).accounts({
            userAccount: userAccountPda,
            signer: fileSystemWallet.publicKey,
            systemProgram: SYSTEM_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
        }).signers([])
        .rpc({skipPreflight:true});
        console.log('redeemed burn entry (bridge system should mint/allocate the token on the other chain for user if invoking this function) with sig:\n');
        console.log(redeemSig);
        const finalUserData = await program.account.userAccount.fetch(userAccountPda);
        console.log("burn entries: " + finalUserData.burnEntries.length);
        finalUserData.burnEntries.map(e => console.log('ticker: ' + e.ticker, 'amount: ' + e.amount.toNumber(), "chain: " + e.chain, "cross-chain-address: " + e.crossChainAddress));

    });
});
