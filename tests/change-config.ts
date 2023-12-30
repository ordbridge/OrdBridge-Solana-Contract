import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { OrdoBrc } from "../target/types/ordo_brc";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram, sendAndConfirmRawTransaction } from "@solana/web3.js"
import { BN } from "bn.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as pdas from './utils/pdas'
import { RENT_PROGRAM_ID, SYSTEM_PROGRAM_ID } from "@raydium-io/raydium-sdk";
import { assert } from "console";



describe("Change-config", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.OrdoBrc as Program<OrdoBrc>;
    const fileSystemWallet = anchor.getProvider();
    const configPda = pdas.getConfig(program.programId);

    it("changes only burn flat fee", async () => {


        const sig = await program.methods.changeConfig({
            newBurnFlatFee: 0.01,
            newMintFlatFee: null,
            newMintPercentageFee: null
        })
            .accounts({
                configAccount: configPda,
                signer: fileSystemWallet.publicKey,
                systemProgram: SYSTEM_PROGRAM_ID,
                rent: RENT_PROGRAM_ID,
            }).rpc({ skipPreflight: true })
        //
        console.log(`Transaction Sig: ${sig}`)
        const configData = await program.account.config.fetch(configPda)
        console.log(configData)
    });

    it("changes only mint flat fee", async () => {
        const sig = await program.methods.changeConfig({
            newBurnFlatFee: null,
            newMintFlatFee: 0.01,
            newMintPercentageFee: null
        })
            .accounts({
                configAccount: configPda,
                signer: fileSystemWallet.publicKey,
                systemProgram: SYSTEM_PROGRAM_ID,
                rent: RENT_PROGRAM_ID,
            }).rpc({ skipPreflight: true })
        //
        console.log(`Transaction Sig: ${sig}`)
        const configData = await program.account.config.fetch(configPda)
        console.log(configData)
    });

    it("changes only mint percentage fee", async () => {
        const sig = await program.methods.changeConfig({
            newBurnFlatFee: null,
            newMintFlatFee: null,
            newMintPercentageFee: 0.025
        })
            .accounts({
                configAccount: configPda,
                signer: fileSystemWallet.publicKey,
                systemProgram: SYSTEM_PROGRAM_ID,
                rent: RENT_PROGRAM_ID,
            }).rpc({ skipPreflight: true })
        //
        console.log(`Transaction Sig: ${sig}`)
        const configData = await program.account.config.fetch(configPda)
        console.log(configData)
    });

    it("changes all config fields", async () => {
        const sig = await program.methods.changeConfig({
            newBurnFlatFee: 0.012,
            newMintFlatFee: 0.012,
            newMintPercentageFee: 0.02
        })
            .accounts({
                configAccount: configPda,
                signer: fileSystemWallet.publicKey,
                systemProgram: SYSTEM_PROGRAM_ID,
                rent: RENT_PROGRAM_ID,
            }).rpc({ skipPreflight: true })
        //
        console.log(`Transaction Sig: ${sig}`)
        const configData = await program.account.config.fetch(configPda)
        console.log(configData)
    });
});
