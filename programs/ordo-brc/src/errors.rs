use anchor_lang::prelude::*;

#[error_code]
pub enum OrdoBrcError {
    #[msg("Failed to verify NFT")]
    NotVerified,
    #[msg("Invalid Update Authority")]
    UpdateAuthorityMismatch,
    #[msg("incorrect third party signer account")]
    InvalidThirdParySigner,
    #[msg("invalid Token Standard")]
    TokenStandardMismatch,
    #[msg("invalid Token Amount")]
    TokenAmountError,
    #[msg("Insufficient funds for operation")]
    InsufficientFunds,
    #[msg("Invalid Third Party Signer Authority")]
    InvalidPointsAuthority,
    #[msg("Insufficient Points for operation")]
    InsufficientPoints,
    #[msg("Invalid Fee argument supplied")]
    InvalidFee,
    #[msg("decimals or ticker length is invalid")]
    InvalidWrappedCreationArgs,
    #[msg("Attempt to mint more than max supply of wrapped token")]
    MaxSupplySurpassed,
    #[msg("Pending Claim not Found")]
    NoPendingClaimFound,
    #[msg("Invalid Chain ID (name too long)")]
    InvalidChainID,
    #[msg("Attempt to redeem from a burn entry that is not found")]
    NoBurnEntryFound,
}
