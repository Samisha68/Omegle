use anchor_lang::prelude::*;

declare_id!("JQosj8w7CKxUcjQJLTQarcEEFh6tf9rb6k8Lk89ND6w"); // Will be generated during build

#[program]
pub mod solana_tip_program {
    use super::*;

    // Simple function to send a fixed-amount tip
    pub fn send_tip(ctx: Context<SendTip>) -> Result<()> {
        // Fixed tip amount: 0.0002 SOL in lamports
        let amount = 200_000;
        
        // Transfer lamports from tipper to recipient
        let tipper = &ctx.accounts.tipper;
        let recipient = &ctx.accounts.recipient;

        // Log the details
        msg!("Sending {} lamports from {} to {}", 
             amount,
             tipper.key(),
             recipient.key());

        // Transfer SOL from tipper to recipient
        // Anchor handles the CPI to the System Program automatically with transfer_lamports()
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: tipper.to_account_info(),
                    to: recipient.to_account_info(),
                },
            ),
            amount,
        )?;

        msg!("Tip transfer completed successfully!");
        Ok(())
    }
}

// Accounts required for the send_tip instruction
#[derive(Accounts)]
pub struct SendTip<'info> {
    #[account(mut)]
    pub tipper: Signer<'info>,
    #[account(mut)]
    /// CHECK: This is the tip recipient, we're just transferring SOL to this account
    pub recipient: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}