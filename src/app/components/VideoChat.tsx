// components/VideoChat.tsx
import { useState, useEffect, useRef, FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import TipButton from './TipButton';

interface VideoChatProps {
  onPeerConnect: (connection: RTCPeerConnection, walletAddress: string) => void;
  onEndChat: () => void;
}

interface Peer {
  id: string;
  walletAddress: string | null;
}

// In a real implementation, you would use a service like Socket.io
// for signaling and managing WebRTC connections
const VideoChat: FC<VideoChatProps> = ({ onPeerConnect, onEndChat }) => {
  const { publicKey, connected } = useWallet();
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [peerWalletAddress, setPeerWalletAddress] = useState<string | null>(null);
  const [needsWalletConnection, setNeedsWalletConnection] = useState<boolean>(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Check if wallet is connected before proceeding
  useEffect(() => {
    if (!connected) {
      setNeedsWalletConnection(true);
      setError("Please connect your wallet to continue");
    } else {
      setNeedsWalletConnection(false);
      setError(null);
      // Only start the video stream if wallet is connected
      startLocalStream();
    }
  }, [connected]);

  // Mock function to simulate finding a peer
  const findPeer = async (): Promise<Peer> => {
    return new Promise((resolve) => {
      // In a real app, this would connect to your signaling server
      // and match with another user who has also connected their wallet
      setTimeout(() => {
        resolve({
          id: 'peer-' + Math.floor(Math.random() * 1000),
          walletAddress: null // This will be set during actual signaling
        });
      }, 2000);
    });
  };

  // Start local video stream
  const startLocalStream = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // After getting local stream, find a peer
      connectToPeer();
    } catch (err) {
      setError("Couldn't access camera and microphone");
      console.error(err);
    }
  };

  useEffect(() => {
    // Clean up when component unmounts
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  const connectToPeer = async (): Promise<void> => {
    if (!publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      setIsConnecting(true);
      
      // 1. Find a peer to connect with
      const peer = await findPeer();
      
      // 2. Initialize WebRTC peer connection
      const configuration: RTCConfiguration = { 
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] 
      };
      
      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;
      
      // 3. Add local tracks to the connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          if (localStreamRef.current) {
            peerConnection.addTrack(track, localStreamRef.current);
          }
        });
      }
      
      // 4. Set up event handlers for remote stream
      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // 5. Exchange signaling data including wallet addresses
      // In a real implementation, this would be done through your signaling server
      const mySignalingData = {
        // other connection data...
        walletAddress: publicKey.toString()
      };
      
      // Send your wallet address in the signaling data
      console.log("Sending signaling data with wallet:", mySignalingData);
      
      // Simulate receiving peer's signaling data with their wallet address
      // In a real app, this would come from your signaling server
      setTimeout(() => {
        // Simulate receiving peer wallet address
        // This is where you'd actually get the peer's wallet address from signaling
        const peerWalletAddr = "PEER_WALLET_ADDRESS_FROM_SIGNALING";
        setPeerWalletAddress(peerWalletAddr);
        
        setIsConnecting(false);
        setIsConnected(true);
        
        // Notify parent component of the connection
        onPeerConnect(peerConnection, peerWalletAddr);
      }, 2000);
      
    } catch (err) {
      setError("Failed to connect to a peer");
      setIsConnecting(false);
      console.error(err);
    }
  };

  return (
    <div className="video-chat">
      {error && (
        <div className="mb-4 p-3 bg-red-700 text-white rounded">
          {error}
        </div>
      )}
      
      {needsWalletConnection ? (
        <div className="p-6 bg-gray-800 rounded-lg text-center">
          <h3 className="text-xl mb-4">Connect Your Wallet</h3>
          <p className="mb-4">You need to connect your Solana wallet to use the video chat and tipping features.</p>
          <p className="text-sm text-gray-400">Use the wallet button in the navigation bar above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-lg bg-black"
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-sm px-2 py-1 rounded">
              You {publicKey?.toString().slice(0, 6)}...
            </div>
          </div>
          
          <div className="relative">
            {isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
                  <p>Finding someone to chat with...</p>
                </div>
              </div>
            )}
            
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg bg-black"
            />
            
            {isConnected && (
              <>
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-sm px-2 py-1 rounded">
                  Peer {peerWalletAddress ? `${peerWalletAddress.slice(0, 6)}...` : 'Unknown'}
                </div>
                
                <div className="absolute bottom-2 right-2">
                  {peerWalletAddress && (
                    <TipButton recipientAddress={peerWalletAddress} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoChat;