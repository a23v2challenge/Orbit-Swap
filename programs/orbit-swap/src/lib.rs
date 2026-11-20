use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{
        self, spl_token::instruction::AuthorityType, Mint, MintTo, SetAuthority, Token,
        TokenAccount, TransferChecked,
    },
};

declare_id!("EUBa3ZVZamiD8c18cPmfohEWnpTkeo9ZpSfB2kT7gNTs");

const DECIMALS: u8 = 6;
const UNIT: u64 = 1_000_000;
const INITIAL_RESERVE: u64 = 1_000 * UNIT;
const PRACTICE_BALANCE: u64 = 100 * UNIT;
const BPS: u128 = 10_000;
const FEE_BPS: u128 = 30;

#[program]
pub mod orbit_swap {
    use super::*;

    pub fn initialize_pool(ctx: Context<InitializePool>) -> Result<()> {
        let accounts = ctx.accounts;
        let owner = accounts.owner.key();
        let bump = [ctx.bumps.pool];
        accounts.pool.set_inner(DemoPool {
            owner,
            bump: bump[0],
        });

        let pool_seeds: &[&[u8]] = &[b"pool", owner.as_ref(), &bump];
        let signer = &[pool_seeds];
        let token = accounts.token_program.to_account_info();
        let authority = accounts.pool.to_account_info();

        for (mint, vault, wallet) in [
            (&accounts.mint_a, &accounts.vault_a, &accounts.wallet_a),
            (&accounts.mint_b, &accounts.vault_b, &accounts.wallet_b),
        ] {
            for (recipient, amount) in [(vault, INITIAL_RESERVE), (wallet, PRACTICE_BALANCE)] {
                token::mint_to(
                    CpiContext::new_with_signer(
                        token.clone(),
                        MintTo {
                            mint: mint.to_account_info(),
                            to: recipient.to_account_info(),
                            authority: authority.clone(),
                        },
                        signer,
                    ),
                    amount,
                )?;
            }
            token::set_authority(
                CpiContext::new_with_signer(
                    token.clone(),
                    SetAuthority {
                        current_authority: authority.clone(),
                        account_or_mint: mint.to_account_info(),
                    },
                    signer,
                ),
                AuthorityType::MintTokens,
                None,
            )?;
        }

        Ok(())
    }

    pub fn swap(ctx: Context<Swap>, a_to_b: bool, amount_in: u64, minimum_out: u64) -> Result<()> {
        require!(minimum_out > 0, SwapError::InvalidMinimum);
        let accounts = ctx.accounts;
        let reserve_a_before = accounts.vault_a.amount;
        let reserve_b_before = accounts.vault_b.amount;
        let (mint_in, mint_out, wallet_in, wallet_out, vault_in, vault_out) = if a_to_b {
            (
                &accounts.mint_a,
                &accounts.mint_b,
                &accounts.wallet_a,
                &accounts.wallet_b,
                &accounts.vault_a,
                &accounts.vault_b,
            )
        } else {
            (
                &accounts.mint_b,
                &accounts.mint_a,
                &accounts.wallet_b,
                &accounts.wallet_a,
                &accounts.vault_b,
                &accounts.vault_a,
            )
        };
        require!(wallet_in.amount >= amount_in, SwapError::InsufficientBalance);
        let (amount_out, fee_amount) = quote(amount_in, vault_in.amount, vault_out.amount)?;
        require!(amount_out >= minimum_out, SwapError::MinimumOutputNotMet);

        token::transfer_checked(
            CpiContext::new(
                accounts.token_program.to_account_info(),
                TransferChecked {
                    from: wallet_in.to_account_info(),
                    mint: mint_in.to_account_info(),
                    to: vault_in.to_account_info(),
                    authority: accounts.owner.to_account_info(),
                },
            ),
            amount_in,
            DECIMALS,
        )?;

        let owner = accounts.owner.key();
        let bump = [accounts.pool.bump];
        let pool_seeds: &[&[u8]] = &[b"pool", owner.as_ref(), &bump];
        token::transfer_checked(
            CpiContext::new_with_signer(
                accounts.token_program.to_account_info(),
                TransferChecked {
                    from: vault_out.to_account_info(),
                    mint: mint_out.to_account_info(),
                    to: wallet_out.to_account_info(),
                    authority: accounts.pool.to_account_info(),
                },
                &[pool_seeds],
            ),
            amount_out,
            DECIMALS,
        )?;

        accounts.vault_a.reload()?;
        accounts.vault_b.reload()?;
        emit!(SwapExecuted {
            pool: accounts.pool.key(),
            owner,
            a_to_b,
            amount_in,
            amount_out,
            fee_amount,
            reserve_a_before,
            reserve_b_before,
            reserve_a_after: accounts.vault_a.amount,
            reserve_b_after: accounts.vault_b.amount,
        });
        Ok(())
    }
}

fn quote(amount_in: u64, reserve_in: u64, reserve_out: u64) -> Result<(u64, u64)> {
    require!(amount_in > 0, SwapError::InvalidAmount);
    require!(reserve_in > 0 && reserve_out > 0, SwapError::EmptyPool);
    let gross = u128::from(amount_in);
    let fee = (gross * FEE_BPS).div_ceil(BPS);
    let net = gross - fee;
    let amount_out = u128::from(reserve_out) * net / (u128::from(reserve_in) + net);
    require!(amount_out > 0, SwapError::AmountTooSmall);
    Ok((amount_out as u64, fee as u64))
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init, payer = owner, space = 8 + DemoPool::INIT_SPACE,
        seeds = [b"pool", owner.key().as_ref()], bump
    )]
    pub pool: Account<'info, DemoPool>,
    #[account(
        init, payer = owner, seeds = [b"mint-a", pool.key().as_ref()], bump,
        mint::decimals = DECIMALS, mint::authority = pool
    )]
    pub mint_a: Account<'info, Mint>,
    #[account(
        init, payer = owner, seeds = [b"mint-b", pool.key().as_ref()], bump,
        mint::decimals = DECIMALS, mint::authority = pool
    )]
    pub mint_b: Account<'info, Mint>,
    #[account(init, payer = owner, associated_token::mint = mint_a, associated_token::authority = pool)]
    pub vault_a: Account<'info, TokenAccount>,
    #[account(init, payer = owner, associated_token::mint = mint_b, associated_token::authority = pool)]
    pub vault_b: Account<'info, TokenAccount>,
    #[account(init, payer = owner, associated_token::mint = mint_a, associated_token::authority = owner)]
    pub wallet_a: Account<'info, TokenAccount>,
    #[account(init, payer = owner, associated_token::mint = mint_b, associated_token::authority = owner)]
    pub wallet_b: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [b"pool", owner.key().as_ref()], bump = pool.bump, has_one = owner)]
    pub pool: Account<'info, DemoPool>,
    #[account(seeds = [b"mint-a", pool.key().as_ref()], bump)]
    pub mint_a: Account<'info, Mint>,
    #[account(seeds = [b"mint-b", pool.key().as_ref()], bump)]
    pub mint_b: Account<'info, Mint>,
    #[account(mut, associated_token::mint = mint_a, associated_token::authority = pool)]
    pub vault_a: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = mint_b, associated_token::authority = pool)]
    pub vault_b: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = mint_a, associated_token::authority = owner)]
    pub wallet_a: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = mint_b, associated_token::authority = owner)]
    pub wallet_b: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct DemoPool {
    pub owner: Pubkey,
    pub bump: u8,
}

#[event]
pub struct SwapExecuted {
    pub pool: Pubkey,
    pub owner: Pubkey,
    pub a_to_b: bool,
    pub amount_in: u64,
    pub amount_out: u64,
    pub fee_amount: u64,
    pub reserve_a_before: u64,
    pub reserve_b_before: u64,
    pub reserve_a_after: u64,
    pub reserve_b_after: u64,
}

#[error_code]
pub enum SwapError {
    #[msg("Enter a positive amount.")]
    InvalidAmount,
    #[msg("Set a positive minimum output.")]
    InvalidMinimum,
    #[msg("The pool has no liquidity.")]
    EmptyPool,
    #[msg("This amount is too small to receive any tokens.")]
    AmountTooSmall,
    #[msg("The wallet does not have enough input tokens.")]
    InsufficientBalance,
    #[msg("Swap output is below the minimum.")]
    MinimumOutputNotMet,
}
