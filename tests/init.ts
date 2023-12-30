import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { OrdoBrc } from "../target/types/ordo_brc";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram, sendAndConfirmRawTransaction } from "@solana/web3.js"
import { BN } from "bn.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as pdas from './utils/pdas'
import { RENT_PROGRAM_ID, SYSTEM_PROGRAM_ID } from "@raydium-io/raydium-sdk";


describe("ordo-initialize", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.OrdoBrc as Program<OrdoBrc>;
  const fileSystemWallet = anchor.getProvider();


  it("Initializes the contract's fundamental accounts", async () => {


    const configPda = pdas.getConfig(program.programId);
    const globalStatePda = pdas.getGlobalState(program.programId);
    try {
      const sig = await program.methods.initialize()
        .accounts({
          globalStateAccount: globalStatePda,
          configAccount: configPda,
          signer: fileSystemWallet.publicKey,
          systemProgram: SYSTEM_PROGRAM_ID,
          rent: RENT_PROGRAM_ID,
        }).rpc({ skipPreflight: true })
      console.log(`Transaction Sig: ${sig}`)
    } catch (e) {
      console.log(e);
      console.log('program is already initialized!!')
    }
    console.log(await program.account.config.fetch(configPda))
    console.log(await program.account.globalState.fetch(globalStatePda))
  });
});
