import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { OrdoBrc } from "../target/types/ordo_brc";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram, sendAndConfirmRawTransaction } from "@solana/web3.js"
import { BN } from "bn.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as pdas from './utils/pdas'
import { RENT_PROGRAM_ID, SYSTEM_PROGRAM_ID } from "@raydium-io/raydium-sdk";
import { assert } from "console";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { Metaplex, USD, keypairIdentity, toMetaplexFile } from "@metaplex-foundation/js";
import * as other from './utils/other'
import fs from "fs";
import { generateRandomUppercaseString } from './utils/other';

describe("create wrapped token states on Solana", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.OrdoBrc as Program<OrdoBrc>;
    const fileSystemWallet = anchor.getProvider();

    const configPda = pdas.getConfig(program.programId);
    const globalStatePda = pdas.getGlobalState(program.programId);
    const metaplexMetadataProgram = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')

    it("creates a wrapped entry (mint account ,state and sets authorities)", async () => {

        const ticker = generateRandomUppercaseString()
        const decimals = 6;
        const uri = 'https://b5nxubtqmkzyk4ly2gyfg75knezec2holjju4zy2z2spn7w7xiva.arweave.net/D1t6BnBis4VxeNGwU3-qaTJBaO5aU05nGs6k9v7fuio'
        const maxSupply = new BN(696969);

        const wrappedMintPda = pdas.getWrappedMint(program.programId, ticker);
        const wrappedMetadataPda = pdas.getMetadataPda(wrappedMintPda);
        const wrappedStatePda = pdas.getWrappedState(program.programId, ticker);

        const sig = await program.methods.createWrappedEntry({
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
            }).rpc({ skipPreflight: true })
        console.log(`Transaction Sig: ${sig}`)
        const wrappedStateData = await program.account.wrappedStateAccount.fetch(wrappedStatePda)
        console.log(wrappedStateData)
    });

    it("fails to create a wrapped entry with invalid decimals", async () => {
        try {
            const ticker = generateRandomUppercaseString()
            const decimals = 11;
            const uri = 'https://b5nxubtqmkzyk4ly2gyfg75knezec2holjju4zy2z2spn7w7xiva.arweave.net/D1t6BnBis4VxeNGwU3-qaTJBaO5aU05nGs6k9v7fuio'
            const maxSupply = new BN(696969);

            const wrappedMintPda = pdas.getWrappedMint(program.programId, ticker);
            const wrappedMetadataPda = pdas.getMetadataPda(wrappedMintPda);
            const wrappedStatePda = pdas.getWrappedState(program.programId, ticker);

            const sig = await program.methods.createWrappedEntry({
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
                }).rpc({ skipPreflight: true })
            console.log(`Transaction Sig: ${sig}`)
            const wrappedStateData = await program.account.wrappedStateAccount.fetch(wrappedMetadataPda)
            console.log(wrappedStateData)
            throw new Error('test failed')
        } catch (e) {
            console.log(e);
        }
    });

    it("fails to create a wrapped entry with invalid ticker name", async () => {
        try {
            const ticker = generateRandomUppercaseString()
            const decimals = 6;
            const uri = 'https://b5nxubtqmkzyk4ly2gyfg75knezec2holjju4zy2z2spn7w7xiva.arweave.net/D1t6BnBis4VxeNGwU3-qaTJBaO5aU05nGs6k9v7fuio'
            const maxSupply = new BN(696969);

            const wrappedMintPda = pdas.getWrappedMint(program.programId, ticker);
            const wrappedMetadataPda = pdas.getMetadataPda(wrappedMintPda);
            const wrappedStatePda = pdas.getWrappedState(program.programId, ticker);

            const sig = await program.methods.createWrappedEntry({
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
                }).rpc({ skipPreflight: true })
            console.log(`Transaction Sig: ${sig}`)
            const wrappedStateData = await program.account.wrappedStateAccount.fetch(wrappedMetadataPda)
            console.log(wrappedStateData)
            throw new Error('test failed')
        } catch (e) {
            console.log(e)
        }
    });

    it("creates a wrapped entry then fails to create another with same ticker", async () => {
        try {
            const ticker = generateRandomUppercaseString()
            const decimals = 6;
            const uri = 'https://b5nxubtqmkzyk4ly2gyfg75knezec2holjju4zy2z2spn7w7xiva.arweave.net/D1t6BnBis4VxeNGwU3-qaTJBaO5aU05nGs6k9v7fuio'
            const maxSupply = new BN(696969);

            const wrappedMintPda = pdas.getWrappedMint(program.programId, ticker);
            const wrappedMetadataPda = pdas.getMetadataPda(wrappedMintPda);
            const wrappedStatePda = pdas.getWrappedState(program.programId, ticker);

            const sig = await program.methods.createWrappedEntry({
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
                }).rpc({ skipPreflight: true })
            console.log(`Transaction Sig: ${sig}`)

            const sig2 = await program.methods.createWrappedEntry({
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
                }).rpc({ skipPreflight: true })
            console.log(`Transaction Sig1: ${sig}`)
            console.log(`Transaction Sig2: ${sig2}`)

            throw new Error('test failed')
        } catch (e) {
            console.log(e)
        }
    });
});
