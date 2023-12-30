use anchor_lang::prelude::*;

//global state account
#[account]
#[derive(Default)]
pub struct GlobalState {
    pub bridged_assets: u128,
    pub user_accounts: u128,
}
impl GlobalState {
    pub const MAX_SIZE: usize = 16 + 16;
}

//config account
#[account]
#[derive(Default)]
pub struct Config {
    pub burn_flat_fee: f32,
    pub mint_flat_fee: f32,
    pub mint_percentage_fee: f32,
}
impl Config {
    pub const MAX_SIZE: usize = 4 + 4 + 4;
}

//wrapped state account (holds data about token suck as ticker and supply)
#[account]
#[derive(Default)]
pub struct WrappedStateAccount {
    pub max_supply: u128,
    pub ticker: String,
}
impl WrappedStateAccount {
    pub const MAX_SIZE: usize = 16 + (4 + 5);
}



#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PendingClaim {
    pub ticker: String,
    pub amount: u128,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BurnEntry {
    pub chain: String,
    pub ticker: String,
    pub amount: u128,
    pub cross_chain_address: String,
}


#[account]
#[derive(Default)]
pub struct UserAccount {
    pub pending_claims: Vec<PendingClaim>,
    pub burn_entries: Vec<BurnEntry>,
}
impl UserAccount {
    pub const INIT_SIZE: usize = (4 + 26) + (4 + 100);
}
