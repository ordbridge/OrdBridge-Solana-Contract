use anchor_lang::prelude::*;
use anchor_spl::token::{
    burn, mint_to, Burn, MintTo,
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use anchor_spl::metadata::mpl_token_metadata::instructions::{
    CreateMetadataAccountV3Cpi, CreateMetadataAccountV3CpiAccounts,
    CreateMetadataAccountV3InstructionArgs,
};
use anchor_spl::metadata::mpl_token_metadata::types::DataV2;
use std::borrow::Borrow;
use anchor_lang::solana_program::{program::invoke, system_instruction};

mod constants;
mod errors;
mod program_accounts;
mod utils;

use constants::*;
use errors::*;
use program_accounts::*;
use utils::*;

declare_id!("{use your key}"); //Check README for more info

#[program]
pub mod ordo_brc {

    use anchor_lang::system_program::{transfer, Transfer};

    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let accounts: &mut Initialize<'_> = ctx.accounts;
        accounts.global_state_account.bridged_assets = 0;
        accounts.config_account.burn_flat_fee = 0.0;
        accounts.config_account.mint_flat_fee = 0.0;
        accounts.config_account.mint_percentage_fee = 0.0;
        msg!("Program initialized!");
        Ok(())
    }

    pub fn change_config(ctx:Context<ChangeConfig>, args:ChangeConfigParams) -> Result<()> {
        let accounts: &mut ChangeConfig<'_> = ctx.accounts;
        
        accounts.config_account.burn_flat_fee = args.new_burn_flat_fee.unwrap_or(
            accounts.config_account.burn_flat_fee
        ); 
        accounts.config_account.mint_flat_fee = args.new_mint_flat_fee.unwrap_or(
            accounts.config_account.mint_flat_fee
        ); 
        accounts.config_account.mint_percentage_fee = args.new_mint_percentage_fee.unwrap_or(
            accounts.config_account.mint_percentage_fee
        );

        msg!("config changed!");
        Ok(())
    }

    pub fn create_wrapped_entry(ctx:Context<CreateWrappedEntry>, args:CreateWrappedEntryArgs) -> Result<()> {
        
        let accounts: &mut CreateWrappedEntry<'_> = ctx.accounts;

        let global_state_seeds:&[&[u8]; 2] = &[GLOBAL_STATE_SEED,&[ctx.bumps.global_state_account]];
        let global_state_as_signer: &[&[&[u8]]; 1] = &[&global_state_seeds[..]];

        accounts.wrapped_state_account.max_supply = args.max_supply;
        accounts.wrapped_state_account.ticker = args.ticker.to_uppercase();
        accounts.global_state_account.bridged_assets+=1;
        
        
        CreateMetadataAccountV3Cpi::new(
            &(accounts.token_metadata_program.to_account_info()),
            CreateMetadataAccountV3CpiAccounts{
              metadata: &accounts.wrapped_metadata_account.to_account_info(),
              mint: &accounts.wrapped_mint_account.to_account_info(),
              mint_authority: &accounts.global_state_account.to_account_info(),
              payer: &accounts.signer.to_account_info(),
              update_authority: (&accounts.signer.to_account_info(), true),
              system_program: &accounts.system_program.to_account_info(),
              rent: Some(&accounts.rent.to_account_info()),
            },
            CreateMetadataAccountV3InstructionArgs{
              data:DataV2 {
                name: (String::from("Wrapped ") + args.ticker.to_uppercase().as_str()),
                symbol: (String::from("w") + args.ticker.to_uppercase().as_str()),
                uri: (args.uri),
                seller_fee_basis_points: (0),
                creators: (None),
                collection: (None),
                uses: (None) 
              },
              is_mutable:true,
              collection_details: None
            },
          ).invoke_signed(global_state_as_signer)?;
        
        Ok(())
    }

    pub fn add_user_pending_claim(ctx:Context<AddUserPendingClaim>, args:AddUserPendingClaimArgs) -> Result<()>{
        let accounts: &mut AddUserPendingClaim<'_> = ctx.accounts;
        let token_supply: u64 = accounts.wrapped_mint_account.supply;

        //msg!("{}",accounts.user_account.to_account_info().borrow().data_len());
        
        if (token_supply as u128 ) + args.amount > accounts.wrapped_state_account.max_supply {
            return err!(OrdoBrcError::MaxSupplySurpassed);
        }
        
        let new_pending_claim: PendingClaim = PendingClaim{
            amount:args.amount,
            ticker:args.ticker.to_uppercase(),
        };


        let new_size = accounts.user_account.to_account_info().borrow().data_len() + 26;
        let rent = Rent::get()?;
        let new_minimum_balance: u64 = rent.minimum_balance(new_size);


        if accounts.user_account.get_lamports() < new_minimum_balance{
            let lamports_diff: u64 = new_minimum_balance.saturating_sub(accounts.user_account.get_lamports());
            invoke(
                &system_instruction::transfer(accounts.signer.key, &accounts.user_account.key(), lamports_diff),
                &[
                    accounts.signer.to_account_info(),
                    accounts.user_account.to_account_info(),
                    accounts.system_program.to_account_info(),
                ],
            )?;
            accounts.user_account.to_account_info().realloc(new_size, false)?;
        }

        accounts.user_account.pending_claims.push(new_pending_claim);
        Ok(())
    }

    pub fn claim_tokens(ctx:Context<ClaimTokens>, args:ClaimTokensArgs) -> Result<()>{
        let accounts = ctx.accounts; 

        let global_state_seeds:&[&[u8]; 2] = &[GLOBAL_STATE_SEED,&[ctx.bumps.global_state_account]];
        let global_state_as_signer: &[&[&[u8]]; 1] = &[&global_state_seeds[..]];
        let upr_ticker: String = args.ticker.to_uppercase();
        
        //finding the requested pending claim
        let mut index_to_remove:isize = -1; 
        for i in (0..accounts.user_account.pending_claims.len()){
            let entry: &PendingClaim = &accounts.user_account.pending_claims[i];
            if (entry.ticker == upr_ticker) && (entry.amount == args.amount) {
              index_to_remove = i as isize;
            }
        }
        if index_to_remove == -1 {
            return err!(OrdoBrcError::NoPendingClaimFound)
        }
        //msg!("index to remove: {}",index_to_remove);
        
        let mint_fee: u64 = (args.amount as u64) - (args.amount as f64 * accounts.config_account.mint_percentage_fee as f64) as u64;
        let mint_amount: u64 = (args.amount as u64) - mint_fee;
        let flat_fee:u64 = (accounts.config_account.mint_flat_fee as f64 * LAMPORTS_PER_SOL as f64) as u64;

        //msg!("{}",mint_fee);
        //msg!("{}",mint_amount);
        //msg!("{}",flat_fee);

        //mint bridged tokens to signer wallet
        let mint_to_signer_accounts = MintTo {
          mint: accounts.wrapped_mint_account.to_account_info(),
          to: accounts.signer_ata.to_account_info(),
          authority: accounts.global_state_account.to_account_info(),
        };
        mint_to(
            CpiContext::new_with_signer(accounts.token_program.to_account_info(), mint_to_signer_accounts, global_state_as_signer),
            mint_amount * 10u64.pow(accounts.wrapped_mint_account.decimals as u32) ,
        )?;

        //mint bridged tokens fee to admin wallet
        let mint_to_admin_accounts = MintTo {
            mint: accounts.wrapped_mint_account.to_account_info(),
            to: accounts.admin_ata.to_account_info(),
            authority: accounts.global_state_account.to_account_info(),
          };
        mint_to(
            CpiContext::new_with_signer(accounts.token_program.to_account_info(), mint_to_admin_accounts, global_state_as_signer),
            mint_fee * 10u64.pow(accounts.wrapped_mint_account.decimals as u32) ,
        )?;
        
        //sending flat sol fee to admin
        transfer(CpiContext::new(
            accounts.system_program.to_account_info(),
            Transfer{
              from: accounts.signer.to_account_info(),
              to: accounts.admin.to_account_info(),
            }),
            flat_fee 
        )?;
        
        
        //removin pending claim
        accounts.user_account.pending_claims.swap_remove(index_to_remove as usize);
        
        Ok(())
    }

    pub fn burn_tokens(ctx:Context<BurnTokens>, args:BurnTokensArgs) -> Result<()>{
        
        let accounts = ctx.accounts; 

        //let global_state_seeds:&[&[u8]; 2] = &[GLOBAL_STATE_SEED,&[ctx.bumps.global_state_account]];
        //let global_state_as_signer: &[&[&[u8]]; 1] = &[&global_state_seeds[..]];
        let upr_ticker: String = args.ticker.to_uppercase();


        let flat_fee:u64 = (accounts.config_account.burn_flat_fee as f64 * LAMPORTS_PER_SOL as f64) as u64;

        //burning tokens
        let token_program = accounts.token_program.to_account_info();
        let burn_accounts: Burn<'_> = Burn { 
          mint: (accounts.wrapped_mint_account.to_account_info()),
          from: (accounts.signer_ata.to_account_info()),
          authority: (accounts.signer.to_account_info())
        };
        burn(
            CpiContext::new(token_program, burn_accounts),
            args.amount as u64  * 10u64.pow(accounts.wrapped_mint_account.decimals as u32),
        )?;

        

        let new_burn_entry = BurnEntry{
            amount:args.amount,
            ticker:upr_ticker,
            chain:args.chain,
            cross_chain_address:args.cross_chain_address,
        };

        //sending flat sol fee to admin to cover rent expenses on relayer side
        transfer(CpiContext::new(
            accounts.system_program.to_account_info(),
            Transfer{
              from: accounts.signer.to_account_info(),
              to: accounts.admin.to_account_info(),
            }),
            flat_fee 
        )?;

        
        
        let new_size = accounts.user_account.to_account_info().borrow().data_len() + 100;
        let rent = Rent::get()?;
        let new_minimum_balance: u64 = rent.minimum_balance(new_size);

        if accounts.user_account.get_lamports() < new_minimum_balance{
            let lamports_diff: u64 = new_minimum_balance.saturating_sub(accounts.user_account.get_lamports());
            invoke(
                &system_instruction::transfer(accounts.signer.key, &accounts.user_account.key(), lamports_diff),
                &[
                    accounts.signer.to_account_info(),
                    accounts.user_account.to_account_info(),
                    accounts.system_program.to_account_info(),
                ],
            )?;
            accounts.user_account.to_account_info().realloc(new_size, false)?;
        }
        
        accounts.user_account.burn_entries.push(new_burn_entry);
        Ok(())
    }


    pub fn redeem_burn(ctx:Context<RedeemBurn>, args:RedeemBurnArgs) -> Result<()>{
        let accounts = ctx.accounts;
        let upr_ticker: String = args.ticker.to_uppercase();
        
        //finding the requested pending claim
        let mut index_to_remove:isize = -1; 
        for i in (0..accounts.user_account.burn_entries.len()){
            let entry: &BurnEntry = &accounts.user_account.burn_entries[i];
            if (entry.ticker == upr_ticker) && (entry.amount == args.amount) && (entry.chain == args.chain) {
              index_to_remove = i as isize;
            }
        }
        if index_to_remove == -1 {
            return err!(OrdoBrcError::NoBurnEntryFound)
        }
        //removin pending claim
        accounts.user_account.burn_entries.swap_remove(index_to_remove as usize);
        
        Ok(())
    }

}



//initialization Accounts
#[derive(Accounts)]
pub struct Initialize<'info> {

    #[account(
        init, 
        space = 8 + GlobalState::MAX_SIZE,
        payer = signer,
        seeds = [GLOBAL_STATE_SEED],
        bump,
    )]
    pub global_state_account: Account<'info, GlobalState>,
    
    #[account(
        init,
        space = 8 + Config::MAX_SIZE,
        payer = signer,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config_account: Account<'info, Config>,

    #[account(
        mut,
        address = Pubkey::try_from(ADMIN_AUTHORITY).unwrap(),
    )]
    pub signer:Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}



//changing config instruction accounts
#[derive(AnchorSerialize, AnchorDeserialize ,Clone)]
pub struct ChangeConfigParams {
    new_burn_flat_fee: Option<f32>,
    new_mint_flat_fee:Option<f32>,
    new_mint_percentage_fee:Option<f32>,
}
#[derive(Accounts)]
pub struct ChangeConfig<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config_account: Account<'info, Config>,

    #[account(
        address = Pubkey::try_from(ADMIN_AUTHORITY).unwrap(),
    )]
    pub signer:Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}


//creating wrapped token mint state and assigning authorities config instruction accounts
#[derive(AnchorSerialize, AnchorDeserialize ,Clone)]
pub struct CreateWrappedEntryArgs {
    max_supply: u128,
    decimals: u8,
    ticker: String,
    uri: String,
}
#[derive(Accounts)]
#[instruction(args: CreateWrappedEntryArgs)]
pub struct CreateWrappedEntry<'info> {
    
    #[account(
        mut,
        seeds = [GLOBAL_STATE_SEED],
        bump,
    )]
    pub global_state_account: Account<'info, GlobalState>,

    #[account(
        init,
        payer = signer,
        seeds = [WRAPPED_MINT_SEED, args.ticker.to_uppercase().as_bytes()],
        bump,
        mint::authority = global_state_account,
        mint::decimals = args.decimals,
        constraint = (args.decimals >= 0) && (args.decimals <= 18) && (args.ticker.len() == 4) @OrdoBrcError::InvalidWrappedCreationArgs,
    )]
    pub wrapped_mint_account: Account<'info, Mint>,

    ///CHECK: validated by metaplex program CPI call
    #[account(
        mut,
        seeds = [b"metadata", anchor_spl::metadata::ID.as_ref(), wrapped_mint_account.key().as_ref()],
        seeds::program = anchor_spl::metadata::ID,
        bump,
    )]
    pub wrapped_metadata_account: UncheckedAccount<'info>,

    #[account(
        init,
        space = 8 + WrappedStateAccount::MAX_SIZE,
        payer = signer,
        seeds = [WRAPPED_STATE_SEED, args.ticker.to_uppercase().as_str().as_bytes()],
        bump,
    )]
    pub wrapped_state_account: Account<'info, WrappedStateAccount>,

    #[account(
        mut,
        address = Pubkey::try_from(ADMIN_AUTHORITY).unwrap(),
    )]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// CHECK: Metaplex Program ID
    #[account(address = anchor_spl::metadata::ID)]
    pub token_metadata_program: UncheckedAccount<'info>,
}



//creating/update a user account and adding a pending claim entry instruction accounts 
#[derive(AnchorSerialize, AnchorDeserialize ,Clone)]
pub struct AddUserPendingClaimArgs {
    sol_address:Pubkey,
    ticker: String,
    amount:u128,
}
#[derive(Accounts)]
#[instruction(args: AddUserPendingClaimArgs)]
pub struct AddUserPendingClaim<'info>{
    #[account(
        mut,
        seeds = [GLOBAL_STATE_SEED],
        bump,
    )]
    pub global_state_account: Account<'info, GlobalState>,

    #[account(
        seeds = [WRAPPED_MINT_SEED, args.ticker.to_uppercase().as_str().as_bytes()],
        bump,
        mint::authority = global_state_account,
        constraint = (args.ticker.len() == 4),
    )]
    pub wrapped_mint_account: Account<'info, Mint>,

    #[account(
        seeds = [WRAPPED_STATE_SEED, args.ticker.to_uppercase().as_str().as_bytes()],
        bump,
    )]
    pub wrapped_state_account: Account<'info, WrappedStateAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        space = {
            let data_len = user_account.to_account_info().try_data_len().unwrap_or(0);
            if data_len == 0{
                8 + UserAccount::INIT_SIZE
            }else{
                data_len
            }
        },
        seeds = [USER_ACCOUNT_SEED, args.sol_address.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info,UserAccount>,

    #[account(
        mut,
        address = Pubkey::try_from(ADMIN_AUTHORITY).unwrap(),
    )]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}




//signer claiming pending tokens instruction accounts
#[derive(AnchorSerialize, AnchorDeserialize ,Clone)]
pub struct ClaimTokensArgs {
    ticker: String,
    amount:u128,
}
#[derive(Accounts)]
#[instruction(args: ClaimTokensArgs)]
pub struct ClaimTokens<'info>{

    #[account(
        seeds = [GLOBAL_STATE_SEED],
        bump,
    )]
    pub global_state_account: Account<'info, GlobalState>,

    #[account(
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config_account: Account<'info, Config>,

    #[account(
        mut,
        seeds = [WRAPPED_MINT_SEED, args.ticker.to_uppercase().as_str().as_bytes()],
        bump,
        mint::authority = global_state_account,
        constraint = (args.ticker.len() == 4),
    )]
    pub wrapped_mint_account: Account<'info, Mint>,

    #[account(
        seeds = [WRAPPED_STATE_SEED, args.ticker.to_uppercase().as_str().as_bytes()],
        bump,
    )]
    pub wrapped_state_account: Account<'info, WrappedStateAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        space = {
            let data_len = user_account.to_account_info().try_data_len().unwrap_or(0);
            if data_len == 0{
                8 + UserAccount::INIT_SIZE
            }else{
                data_len
            }
        },
        seeds = [USER_ACCOUNT_SEED, signer.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info,UserAccount>,
    
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = wrapped_mint_account,
        associated_token::authority = signer,
    )]
    pub signer_ata:Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = wrapped_mint_account,
        associated_token::authority = admin,
    )]
    pub admin_ata:Account<'info, TokenAccount>,

    
    ///CHECK: WE CHECK ADMIN ACCOUNT ADDRESS AND USE IT FOR ATA VALIDATION
    #[account(
        mut,
        address = Pubkey::try_from(ADMIN_AUTHORITY).unwrap()
    )]
    pub admin: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}


//signer burning his tokens to bridge them later
#[derive(AnchorSerialize, AnchorDeserialize ,Clone)]
pub struct BurnTokensArgs {
    ticker: String,
    amount:u128,
    chain:String,
    cross_chain_address:String,
}
#[derive(Accounts)]
#[instruction(args: BurnTokensArgs)]
pub struct BurnTokens<'info>{
    #[account(
        seeds = [GLOBAL_STATE_SEED],
        bump,
    )]
    pub global_state_account: Account<'info, GlobalState>,

    #[account(
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config_account: Account<'info, Config>,

    #[account(
        mut,
        seeds = [WRAPPED_MINT_SEED, args.ticker.to_uppercase().as_str().as_bytes()],
        bump,
        mint::authority = global_state_account,
        constraint = (args.ticker.len() == 4),
    )]
    pub wrapped_mint_account: Account<'info, Mint>,

    #[account(
        seeds = [WRAPPED_STATE_SEED, args.ticker.to_uppercase().as_str().as_bytes()],
        bump,
    )]
    pub wrapped_state_account: Account<'info, WrappedStateAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        space = {
            let data_len = user_account.to_account_info().try_data_len().unwrap_or(0);
            if data_len == 0{
                8 + UserAccount::INIT_SIZE
            }else{
                data_len
            }
        },
        seeds = [USER_ACCOUNT_SEED, signer.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info,UserAccount>,
    
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = wrapped_mint_account,
        associated_token::authority = signer,
    )]
    pub signer_ata:Account<'info, TokenAccount>,

    //#[account(
    //    init_if_needed,
    //    payer = signer,
    //    associated_token::mint = wrapped_mint_account,
    //    associated_token::authority = admin,
    //)]
    //pub admin_ata:Account<'info, TokenAccount>,

    
    ///CHECK: WE CHECK ADMIN ACCOUNT ADDRESS AND USE IT FOR ATA VALIDATION
    #[account(
        mut,
        address = Pubkey::try_from(ADMIN_AUTHORITY).unwrap()
    )]
    pub admin: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}


//admin removing burn entry from user_account 
#[derive(AnchorSerialize, AnchorDeserialize ,Clone)]
pub struct RedeemBurnArgs {
    ticker: String,
    amount:u128,
    chain:String,
}
#[derive(Accounts)]
#[instruction(args: RedeemBurnArgs)]
pub struct RedeemBurn<'info>{
    
    #[account(
        init_if_needed,
        payer = signer,
        space = {
            let data_len = user_account.to_account_info().try_data_len().unwrap_or(0);
            if data_len == 0{
                8 + UserAccount::INIT_SIZE
            }else{
                data_len
            }
        },
        seeds = [USER_ACCOUNT_SEED, signer.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info,UserAccount>,
    
    ///CHECK: WE CHECK ADMIN ACCOUNT ADDRESS AND USE IT FOR ATA VALIDATION
    #[account(
        mut,
        address = Pubkey::try_from(ADMIN_AUTHORITY).unwrap()
    )]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}