// src/app/components/WalletActions.tsx
"use client";

import { FC, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { FaExchangeAlt, FaSignOutAlt, FaWallet } from 'react-icons/fa';

interface WalletActionsProps {
  className?: string;
}

const WalletActions: FC<WalletActionsProps> = ({ className = "" }) => {
  const { publicKey, wallet, disconnect } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);

  // Get shortened wallet address
  const shortAddress = publicKey ? 
    `${publicKey.toString().substring(0, 4)}...${publicKey.toString().substring(publicKey.toString().length - 4)}` : 
    '';

  // Get wallet provider name 
  const walletName = wallet?.adapter?.name || '';
  
  // Handle disconnect
  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
  };
  
  // Handle switching wallet (this opens the wallet selector modal)
  const handleSwitchWallet = () => {
    // We just need to disconnect first, then user can connect a different wallet
    disconnect();
    setShowDropdown(false);
  };
  
  if (!publicKey) {
    return null;
  }
  
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-2 transition-colors"
      >
        <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center mr-2">
          <FaWallet className="text-xs" />
        </div>
        <span className="mr-2">{shortAddress}</span>
        <span className="text-xs bg-purple-600 rounded-full px-2 py-0.5">{walletName}</span>
      </button>
      
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={handleSwitchWallet}
              className="flex items-center w-full px-4 py-2 text-white hover:bg-gray-700 transition-colors"
            >
              <FaExchangeAlt className="mr-2" />
              Switch Wallet
            </button>
            
            <button
              onClick={handleDisconnect}
              className="flex items-center w-full px-4 py-2 text-red-400 hover:bg-gray-700 transition-colors"
            >
              <FaSignOutAlt className="mr-2" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletActions;