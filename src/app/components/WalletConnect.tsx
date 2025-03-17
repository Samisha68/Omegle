// components/WalletConnect.tsx
import { FC, useMemo } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import required styles


const WalletConnect: FC = () => {
  // Define the network to use (devnet, testnet, or mainnet-beta)
  const network = WalletAdapterNetwork.Devnet;
  
  // The endpoint for the connection to interact with the Solana network
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  
  // Configure supported wallets
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(), 
    new SolflareWalletAdapter()
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <div className="flex justify-center">
          <WalletMultiButton className="connect-wallet-btn" />
        </div>
        <p className="mt-4 text-center text-sm text-gray-400">
          Connect your wallet to start video chats and send tokens
        </p>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletConnect;