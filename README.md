# solana-contracts

To initialize the program, run the following command:

```bash
anchor run test-init
```

After initialization, run the other tests defined in Anchor.toml and feel free to add your own.

For any change in the contract code during development on devnet, use the following commands:

```bash
anchor build && anchor deploy
```

To get the program-derived addresses for accounts, refer to the helper functions in tests/utils/pdas.ts.

To read state from the contract, follow the examples in the tests on how to fetch account data for read operations.

Before deploying to mainnet, ensure to change the ADMIN_AUTHORITY defined in programs/ordo-brc/src/constants.rs.

To determine the minimum size and rent exemption balance needed for the program binary to be uploaded to the chain, run the following commands:

```bash
du -b target/deploy/<program binary>
solana rent <output in bytes>
solana-keygen new -f -o target/deploy/
anchor keys list  # Get the current configured keypair
```

Make sure to have the Solana CLI installed. The balance given will be the minimum amount to fund the program data account on-chain. Funding more than that allows for easier upgrades and additional features.

To change the keypair (keypair for the program) for use on either devnet testing or prod (mainnet) deployment, follow these commands:

Change the declare_id! address to the new address in program/ordo-brc/src/lib.rs. Also, update all keys in Anchor.toml and then run anchor build.

You can find the program IDL in target/idl and TypeScript types in target/types/ordo_brc.ts for use in any client later on.

**Other considerations:**

Change the configured keypair for running tests in Anchor.toml.

Update the RPC endpoint in the [provider] section of Anchor.toml.

For deploying on mainnet, use the mainnet-deploy script. 

Adjust the command to use appropriate funded wallets, RPC endpoints, and ensure the size is correct (around 1.5x the size of the actual program shared binary).