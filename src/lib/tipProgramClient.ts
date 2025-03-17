// src/lib/tipProgramClient.ts
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { AnchorProvider, Program } from '@project-serum/anchor';
import { useAnchorWallet } from '@solana/wallet-adapter-react';

// Import raw JSON
import idlJson from './solana_tip_program.json';

// The program ID from your deployed anchor program
const PROGRAM_ID = new PublicKey('JQosj8w7CKxUcjQJLTQarcEEFh6tf9rb6k8Lk89ND6w');

export function useTipProgram() {
  const wallet = useAnchorWallet();
  
  const sendTip = async (
    connection: Connection,
    recipientPublicKey: PublicKey,
  ) => {
    if (!wallet) throw new Error('Wallet not connected');
    
    // Create a provider
    const provider = new AnchorProvider(
      connection, 
      wallet, 
      { commitment: 'processed' }
    );
    
    // Create program interface using any type to bypass strict TypeScript checks
    const program = new Program(
      idlJson as any, 
      PROGRAM_ID, 
      provider
    );
    
    try {
      // Send the transaction using the method name that matches your IDL
      const tx = await program.methods
        .sendTip()
        .accounts({
          tipper: wallet.publicKey,
          recipient: recipientPublicKey,
          system_program: SystemProgram.programId
        })
        .rpc();
        
      // Confirm the transaction
      await connection.confirmTransaction(tx, 'confirmed');
      
      return tx;
    } catch (error) {
      console.error('Error in sendTip:', error);
      throw error;
    }
  };
  
  return { sendTip };
}