// src/app/page.tsx
"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Lobby from './components/Lobby';
import { FaUsers, FaRandom, FaChevronLeft, FaRing, FaVideo, FaBolt, FaGamepad } from 'react-icons/fa';
import { useWallet } from '@solana/wallet-adapter-react';

// Dynamically import wallet button with SSR disabled
const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

// Dynamically import VideoChat with SSR disabled
const VideoChat = dynamic(
  () => import('./components/VideoChat'),
  { ssr: false }
);

// Dynamically import WalletActions with SSR disabled
const WalletActions = dynamic(
  () => import('./components/WalletActions'),
  { ssr: false }
);

export default function Home() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isVideoMode, setIsVideoMode] = useState<boolean>(false);
  const [selectedMode, setSelectedMode] = useState<'lobby' | 'random' | null>(null);
  const [mounted, setMounted] = useState(false);
  const { publicKey } = useWallet();
  
  // Prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePeerConnect = (peerConnection: RTCPeerConnection, peerWallet: string) => {
    console.log('Connected to peer with wallet:', peerWallet);
    // You could do additional setup here if needed
  };

  const handleEndChat = () => {
    setIsVideoMode(false);
    setSelectedUser(null);
    setSelectedMode(null);
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUser(userId);
    setIsVideoMode(true);
  };

  // Render landing page with options
  const renderLandingPage = () => (
    <div className="w-full max-w-5xl mx-auto">
      {/* Hero Section */}
      <div className="mb-12 text-center">
        <h2 className="text-5xl font-bold mb-4 text-sonic-blue">
          GOTTA CHAT FAST!
        </h2>
        <p className="text-xl text-gray-200 max-w-2xl mx-auto">
          Speedy video chats powered by Solana. Connect with the Sonic ecosystem at lightning speed.
        </p>
      </div>
      
      {/* Options Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        <div 
          onClick={() => publicKey && setSelectedMode('lobby')}
          className={`bg-gray-800 border-2 border-sonic-blue rounded-xl overflow-hidden shadow-lg shadow-sonic-blue/20 hover:shadow-sonic-blue/40 transition-all duration-300 transform hover:translate-y-[-8px] hover:scale-[1.01] ${!publicKey ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
        >
          <div className="h-4 bg-sonic-blue"></div>
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="bg-sonic-blue rounded-full w-12 h-12 flex items-center justify-center mr-3 shadow-md">
                <FaUsers className="text-white text-xl" />
              </div>
              <h2 className="text-2xl font-bold text-white">Lobby Mode</h2>
            </div>
            
            <p className="text-gray-300 mb-6">Browse online users, see who's using Backpack wallet, and choose who to chat with.</p>
            
            <div className="mt-auto flex justify-between items-center">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-sonic-yellow rounded-full mr-2"></div>
                <span className="text-sonic-yellow text-sm">Meet the community</span>
              </div>
              
              <button className="bg-sonic-blue hover:bg-sonic-blue-dark text-white font-bold py-2 px-6 rounded-lg flex items-center">
                <span>Enter</span>
                <FaChevronLeft className="ml-2 rotate-180" />
              </button>
            </div>
            
            {/* Sonic Ring Decoration */}
            <div className="absolute top-4 right-4">
              <FaRing className="text-sonic-yellow text-xl animate-pulse" />
            </div>
          </div>
        </div>
        
        <div 
          onClick={() => {
            if (publicKey) {
              setSelectedMode('random');
              setIsVideoMode(true);
            }
          }}
          className={`bg-gray-800 border-2 border-sonic-green rounded-xl overflow-hidden shadow-lg shadow-sonic-green/20 hover:shadow-sonic-green/40 transition-all duration-300 transform hover:translate-y-[-8px] hover:scale-[1.01] ${!publicKey ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
        >
          <div className="h-4 bg-sonic-green"></div>
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="bg-sonic-green rounded-full w-12 h-12 flex items-center justify-center mr-3 shadow-md">
                <FaBolt className="text-white text-xl" />
              </div>
              <h2 className="text-2xl font-bold text-white">Random Chat</h2>
            </div>
            
            <p className="text-gray-300 mb-6">Jump straight into a video chat with a random person. Quick and spontaneous.</p>
            
            <div className="mt-auto flex justify-between items-center">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-sonic-red rounded-full mr-2"></div>
                <span className="text-sonic-red text-sm">Random matchmaking</span>
              </div>
              
              <button className="bg-sonic-green hover:bg-sonic-green-dark text-white font-bold py-2 px-6 rounded-lg flex items-center">
                <span>Start</span>
                <FaVideo className="ml-2" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="mt-16 pt-6 border-t-2 border-gray-700">
        <div className="flex justify-center mb-8">
          <div className="flex space-x-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-4 h-4 bg-sonic-yellow rounded-full"></div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-lg p-5 border-l-4 border-sonic-blue">
            <div className="w-10 h-10 rounded-full bg-sonic-blue flex items-center justify-center mb-3">
              <FaRing className="text-white" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-white">Wallet Connected</h3>
            <p className="text-gray-400">Your identity is secured through your Solana wallet with Backpack support.</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-5 border-l-4 border-sonic-green">
            <div className="w-10 h-10 rounded-full bg-sonic-green flex items-center justify-center mb-3">
              <FaVideo className="text-white" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-white">P2P Video</h3>
            <p className="text-gray-400">Direct peer-to-peer connection means no intermediary servers store your chats.</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-5 border-l-4 border-sonic-red">
            <div className="w-10 h-10 rounded-full bg-sonic-red flex items-center justify-center mb-3">
              <FaGamepad className="text-white" />
            </div>
            <h3 className="text-lg font-bold mb-2 text-white">Sonic Ecosystem</h3>
            <p className="text-gray-400">Built for the Sonic gaming ecosystem on Solana. Fast, reliable, and fun.</p>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) {
    return null; // Prevent hydration issues
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-between p-4 md:p-16 bg-gray-900 text-white overflow-x-hidden">
      {/* Checkerboard background pattern - classic Sonic game style */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-repeat-x bg-contain" style={{ 
        backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"40\" height=\"40\" viewBox=\"0 0 40 40\"><rect width=\"20\" height=\"20\" fill=\"%230d1117\"/><rect x=\"20\" y=\"20\" width=\"20\" height=\"20\" fill=\"%230d1117\"/><rect x=\"20\" y=\"0\" width=\"20\" height=\"20\" fill=\"%231a202c\"/><rect x=\"0\" y=\"20\" width=\"20\" height=\"20\" fill=\"%231a202c\"/></svg>')" 
      }}></div>
      
      <header className="w-full max-w-5xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center z-10 relative">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-2 flex items-center">
            <span className="text-sonic-blue">Sonic</span>
            <span className="text-white">Chat</span>
            <div className="ml-2 bg-sonic-blue text-xs px-2 py-1 rounded-full text-white">Beta</div>
          </h1>
          <p className="text-gray-400">Connect your wallet to start chatting with the Sonic ecosystem</p>
        </div>
        <div className="mt-6 md:mt-0 flex items-center gap-4">
          {publicKey ? (
            <WalletActions />
          ) : (
            <WalletMultiButton />
          )}
        </div>
      </header>

      <div className="w-full max-w-5xl mx-auto flex-grow z-10 relative">
        {isVideoMode ? (
          <VideoChat 
            onPeerConnect={handlePeerConnect} 
            onEndChat={handleEndChat}
            targetUserId={selectedUser}
          />
        ) : selectedMode === 'lobby' ? (
          <Lobby onSelectUser={handleSelectUser} />
        ) : (
          renderLandingPage()
        )}
      </div>

      {(isVideoMode || selectedMode === 'lobby') && (
        <div className="w-full max-w-5xl mx-auto mt-6 z-10 relative">
          <button 
            onClick={handleEndChat}
            className="px-5 py-2.5 bg-sonic-red hover:bg-sonic-red-dark text-white font-bold rounded-lg flex items-center transform transition-all duration-200"
          >
            <FaChevronLeft className="mr-2" />
            Back to Home
          </button>
        </div>
      )}

      <footer className="w-full max-w-5xl mx-auto mt-12 text-center text-sm text-gray-500 z-10 relative">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <p>Powered by Solana Blockchain • Use Chrome or Firefox for best experience</p>
          <div className="flex items-center mt-2 md:mt-0">
            <span className="mr-2">Optimized for</span>
            <div className="flex items-center bg-gray-800 px-2 py-1 rounded-full">
              <FaRing className="text-sonic-yellow mr-1" />
              <span className="text-xs text-white">Backpack</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}