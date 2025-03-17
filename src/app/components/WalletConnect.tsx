// components/WalletConnect.tsx
'use client';

import { FC, useState, useEffect } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const WalletConnect: FC = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex justify-center">
        <div className="connect-wallet-btn opacity-50">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-center">
        <WalletMultiButton className="connect-wallet-btn" />
      </div>
      <p className="mt-4 text-center text-sm text-gray-400">
        Connect your wallet to start video chats and send tokens
      </p>
    </>
  );
};

export default WalletConnect;