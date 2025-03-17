"use client"
import { useState, useEffect, FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { io, Socket } from 'socket.io-client';
import { FaUser, FaSpinner, FaVideo, FaFilter, FaStar } from 'react-icons/fa';
import Image from 'next/image';

interface LobbyProps {
  onSelectUser: (userId: string) => void;
}

// Only looking for Backpack wallet now
const BACKPACK_WALLET_NAMES = ['backpack'];

const Lobby: FC<LobbyProps> = ({ onSelectUser }) => {
  const { publicKey, wallet } = useWallet();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const [showBackpackOnly, setShowBackpackOnly] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Check if the current user is using Backpack wallet
  const currentWalletProvider = wallet?.adapter?.name || '';
  const isUsingBackpackWallet = BACKPACK_WALLET_NAMES.some(name => 
    currentWalletProvider.toLowerCase().includes(name)
  );

  // Ensure we only run client-side code after mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Use the same signaling server URL as in VideoChat - moved inside the component
  // to ensure it only runs on the client side
  const SIGNALING_SERVER = process.env.NEXT_PUBLIC_SIGNALING_SERVER || 
    (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
      ? '/api/signaling' 
      : 'https://solana-video-chat-signaling.onrender.com');

  interface OnlineUser {
    id: string;
    walletAddress: string;
    anonymousName: string;
    joinedAt: number;
    walletProvider?: string; // To track if user is using Backpack wallet
    isBackpackWallet?: boolean; 
  }

  // Generate anonymous names for users
  const getAnonymousName = (walletAddress: string): string => {
    // Create a deterministic but anonymous name based on wallet
    const shortAddress = walletAddress.slice(0, 4) + '...' + walletAddress.slice(-4);
    return `Anonymous ${shortAddress}`;
  };

  useEffect(() => {
    if (!mounted || !publicKey) return;

    // Connect to the signaling server
    const serverUrl = SIGNALING_SERVER.includes(':10000') 
      ? SIGNALING_SERVER.replace(':10000', '')
      : SIGNALING_SERVER;
    
    console.log('Connecting to signaling server:', serverUrl);
    
    const socket = io(serverUrl, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      timeout: 20000,
      path: serverUrl.includes('/api/signaling') ? '/socket.io' : undefined,
      query: {
        walletAddress: publicKey.toString(),
        walletProvider: currentWalletProvider || 'unknown',
        mode: 'lobby' // Tell server we're in lobby mode
      },
      // Add CORS configuration for local development
      withCredentials: false
    });

    socket.on('connect', () => {
      console.log('Connected to lobby');
      setIsConnecting(false);
      setError(null);
      
      // Request the list of online users
      socket.emit('get_online_users');
    });

    socket.on('connect_error', (err) => {
      console.error('Lobby connection error:', err);
      setIsConnecting(false);
      setError(`Could not connect to lobby: ${err.message}`);
    });

    socket.on('online_users', (users) => {
      // Transform users to add anonymous names and filter out current user
      const transformedUsers = users
        .filter((user: any) => user.walletAddress !== publicKey.toString())
        .map((user: any) => ({
          ...user,
          anonymousName: getAnonymousName(user.walletAddress),
          isBackpackWallet: user.walletProvider ? BACKPACK_WALLET_NAMES.some(name => 
            user.walletProvider.toLowerCase().includes(name)
          ) : false
        }));
      
      setOnlineUsers(transformedUsers);
    });

    socket.on('user_joined', (user) => {
      // Add new user to the list
      if (user.walletAddress !== publicKey.toString()) {
        setOnlineUsers(prev => [
          ...prev.filter(u => u.id !== user.id), // Remove if already exists
          {
            ...user,
            anonymousName: getAnonymousName(user.walletAddress),
            isBackpackWallet: user.walletProvider ? BACKPACK_WALLET_NAMES.some(name => 
              user.walletProvider.toLowerCase().includes(name)
            ) : false
          }
        ]);
      }
    });

    socket.on('user_left', (userId) => {
      // Remove user from the list
      setOnlineUsers(prev => prev.filter(user => user.id !== userId));
    });

    setSocketInstance(socket);

    return () => {
      socket.disconnect();
    };
  }, [publicKey, currentWalletProvider, mounted]);

  const handleSelectUser = (userId: string) => {
    if (socketInstance) {
      // Notify server about the selected user
      socketInstance.emit('initiate_chat', { targetUserId: userId });
      
      // Notify parent component
      onSelectUser(userId);
    }
  };

  // Display visible users (based on filter)
  const visibleUsers = showBackpackOnly 
    ? onlineUsers.filter(user => user.isBackpackWallet)
    : onlineUsers;

  // Don't render anything during SSR to prevent hydration errors
  if (!mounted) {
    return null;
  }

  if (isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-gray-900 text-white">
        <FaSpinner className="animate-spin text-4xl mb-4 text-purple-500" />
        <p className="text-lg">Connecting to lobby...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-red-900/50 text-white">
        <h3 className="text-xl font-bold mb-2">Connection Error</h3>
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Backpack Wallet Badge */}
      {isUsingBackpackWallet && (
        <div className="mb-4 p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-white rounded-full p-1 mr-3">
              <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <FaStar className="text-white text-sm" />
              </div>
            </div>
            <div>
              <p className="font-bold">Backpack Wallet Detected!</p>
              <p className="text-sm opacity-90">You're using {currentWalletProvider}</p>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 rounded-xl bg-gray-900 text-white">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center mb-4 md:mb-0">
            <FaUser className="mr-2" /> Online Users ({visibleUsers.length})
          </h2>

          {/* Filter Control */}
          <div className="flex items-center">
            <button
              onClick={() => setShowBackpackOnly(!showBackpackOnly)}
              className={`flex items-center px-3 py-2 rounded-lg transition ${
                showBackpackOnly 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-800 text-gray-300'
              }`}
            >
              <FaFilter className="mr-2" />
              <span>Backpack Wallets Only</span>
              <div className={`ml-2 w-3 h-3 rounded-full ${showBackpackOnly ? 'bg-green-400' : 'bg-gray-500'}`}></div>
            </button>
          </div>
        </div>
        
        {visibleUsers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {showBackpackOnly ? (
              <>
                <p className="text-lg">No Backpack wallet users online</p>
                <p className="text-sm mt-2">Try disabling the filter or check back later</p>
              </>
            ) : (
              <>
                <p className="text-lg">No users currently online</p>
                <p className="text-sm mt-2">When someone joins, they'll appear here</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleUsers.map(user => (
              <div
                key={user.id}
                className={`p-4 rounded-lg ${
                  user.isBackpackWallet 
                    ? 'bg-gradient-to-r from-gray-800 to-purple-900 shadow-lg shadow-purple-900/20' 
                    : 'bg-gray-800'
                } hover:bg-gray-750 transition cursor-pointer transform hover:scale-[1.02]`}
                onClick={() => handleSelectUser(user.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`relative w-10 h-10 rounded-full ${
                      user.isBackpackWallet 
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600' 
                        : 'bg-purple-600'
                    } flex items-center justify-center mr-3`}>
                      <FaUser />
                      {user.isBackpackWallet && (
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                          <FaStar className="text-xs text-purple-600" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center">
                        <p className="font-medium">{user.anonymousName}</p>
                        {user.isBackpackWallet && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs bg-purple-600 rounded-full">Backpack</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        Online since {new Date(user.joinedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <button
                    className={`ml-2 p-2 ${
                      user.isBackpackWallet 
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600' 
                        : 'bg-purple-600'
                    } hover:opacity-90 rounded-full transition`}
                    title="Start video chat"
                  >
                    <FaVideo />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Lobby; 