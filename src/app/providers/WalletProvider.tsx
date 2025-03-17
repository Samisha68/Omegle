"use client";

import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { 
  PhantomWalletAdapter
} from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Default styles that can be overridden by your app
require('@solana/wallet-adapter-react-ui/styles.css');

interface WalletContextProviderProps {
  children: ReactNode;
}

export const WalletContextProvider: FC<WalletContextProviderProps> = ({ children }) => {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
  const network = WalletAdapterNetwork.Mainnet;

  // You can also provide a custom RPC endpoint.
  const endpoint = useMemo(() => {
    // Use Sonic RPC URL as default for better integration with Backpack
    // Fallback to custom RPC if provided, or Solana's public RPC as last resort
    return process.env.NEXT_PUBLIC_RPC_URL || 
           "https://rpc.sonic.game" || 
           clusterApiUrl(network);
  }, [network]);

  console.log("Using RPC endpoint:", endpoint);

  // Create a list with only Phantom wallet adapter
  // We'll use this as a base since we know it works, but the UI will prompt
  // users to install Backpack if needed
  const wallets = useMemo(
    () => [
      // Only include Phantom wallet adapter as the default option
      new PhantomWalletAdapter()
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletContextProvider; 