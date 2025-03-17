// src/components/TipButton.tsx
'use client';

import { FC, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import TipAnimation from './TipAnimation';
import { useTipProgram } from '@/lib/tipProgramClient';

interface TipButtonProps {
  recipientAddress: string;
  onTipComplete?: () => void;
}

const TipButton: FC<TipButtonProps> = ({ recipientAddress, onTipComplete }) => {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { sendTip } = useTipProgram();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [showAnimation, setShowAnimation] = useState<boolean>(false);

  const handleSendTip = async (): Promise<void> => {
    if (!connected || !publicKey) {
      setTxStatus('Please connect your wallet first.');
      return;
    }

    try {
      setIsLoading(true);
      setTxStatus('Sending tip...');

      // Validate recipient address
      let recipient: PublicKey;
      try {
        recipient = new PublicKey(recipientAddress);
      } catch (error) {
        setTxStatus('Invalid recipient address.');
        setIsLoading(false);
        return;
      }
      
      // Send tip using our Anchor program
      const signature = await sendTip(
        connection,
        recipient
      );

      setTxStatus(`Tip sent successfully! Tx: ${signature.slice(0, 8)}...`);
      
      // Show success animation
      setShowAnimation(true);
      
      // Call the callback if provided
      if (onTipComplete) {
        onTipComplete();
      }
      
      // Reset the status after 3 seconds
      setTimeout(() => {
        setTxStatus(null);
      }, 3000);
    } catch (error) {
      console.error('Error sending tip:', error);
      setTxStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tip-button">
      <button
        onClick={handleSendTip}
        disabled={isLoading || !connected || !publicKey}
        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition duration-300 ${
          isLoading || !connected || !publicKey
            ? 'bg-gray-600 cursor-not-allowed' 
            : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
        }`}
      >
        {isLoading ? (
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        ) : (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
          </svg>
        )}
        <span>{isLoading ? 'Sending...' : 'Send Tip (0.0002 SOL)'}</span>
      </button>
      
      {txStatus && (
        <div className={`mt-2 text-sm p-2 rounded-md ${
          txStatus.includes('Error') || txStatus.includes('Please connect') || txStatus.includes('Invalid')
            ? 'bg-red-900 text-red-200' 
            : txStatus.includes('success') 
              ? 'bg-green-900 text-green-200'
              : 'bg-blue-900 text-blue-200'
        }`}>
          {txStatus}
        </div>
      )}
      
      {showAnimation && (
        <TipAnimation onComplete={() => setShowAnimation(false)} />
      )}
    </div>
  );
};

export default TipButton;