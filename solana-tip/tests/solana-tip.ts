import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaTipProgram } from "../target/types/solana_tip_program";

describe("solana-tip", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  // Use the correct program name from Anchor.toml
  const program = anchor.workspace.solana_tip as Program<SolanaTipProgram>;

  it("Sends a tip!", async () => {
    // Create a test wallet to receive the tip
    const recipient = anchor.web3.Keypair.generate();
    
    // Get the provider's wallet (which will be the tipper)
    const provider = anchor.getProvider() as anchor.AnchorProvider;
    
    // Define the accounts manually to match the IDL
    // Note: The key is 'system_program' with underscore to match the Rust program
    const accounts = {
      tipper: provider.wallet.publicKey,
      recipient: recipient.publicKey,
      system_program: anchor.web3.SystemProgram.programId,
    };
    
    // Send a tip using our program
    try {
      const tx = await program.methods
        .sendTip()
        .accounts(accounts)
        .rpc();
      
      console.log("Your transaction signature", tx);
    } catch (error) {
      console.error("Error sending tip:", error);
      throw error;
    }
  });
});
