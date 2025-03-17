// src/app/page.tsx
'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletConnect from '@/app/components/WalletConnect';
import VideoChat from '@/app/components/VideoChat';

export default function Home() {
  const { connected } = useWallet();
  const [inChat, setInChat] = useState<boolean>(false);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [peerWalletAddress, setPeerWalletAddress] = useState<string>('');

  const startChat = (): void => {
    setInChat(true);
  };

  const endChat = (): void => {
    setInChat(false);
    setPeerWalletAddress('');
  };

  const handlePeerConnect = (connection: RTCPeerConnection, walletAddress: string): void => {
    setPeerConnection(connection);
    setPeerWalletAddress(walletAddress);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <main className="container mx-auto px-4 py-10">
        <h1 className="text-4xl font-bold text-center mb-8">Solana Video Chat</h1>
        
        {!connected ? (
          <div className="max-w-md mx-auto bg-gray-800 rounded-lg p-8 shadow-lg">
            <h2 className="text-2xl font-semibold mb-6 text-center">Connect your wallet to start</h2>
            <WalletConnect />
          </div>
        ) : !inChat ? (
          <div className="max-w-md mx-auto bg-gray-800 rounded-lg p-8 shadow-lg">
            <h2 className="text-2xl font-semibold mb-6 text-center">Ready to chat?</h2>
            <button 
              onClick={startChat}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300"
            >
              Start Random Chat
            </button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg p-6 shadow-lg">
            <VideoChat onPeerConnect={handlePeerConnect} onEndChat={endChat} />
            
            <div className="mt-6 flex justify-center">
              <button 
                onClick={endChat}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300"
              >
                End Chat
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}