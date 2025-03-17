// src/components/VideoChat.tsx
"use client"
import { useState, useEffect, useRef, FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import TipButton from './TipButton';
import { io, Socket } from 'socket.io-client';

interface VideoChatProps {
  onPeerConnect: (connection: RTCPeerConnection, walletAddress: string) => void;
  onEndChat: () => void;
}

const SIGNALING_SERVER = process.env.NEXT_PUBLIC_SIGNALING_SERVER || 'http://localhost:4000';

const VideoChat: FC<VideoChatProps> = ({ onPeerConnect, onEndChat }) => {
  const { publicKey } = useWallet();
  const [isConnecting, setIsConnecting] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [peerWalletAddress, setPeerWalletAddress] = useState<string>('');
  const [isClient, setIsClient] = useState<boolean>(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  
  // Add useEffect to handle client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Connect to signaling server and set up media
  useEffect(() => {
    if (!isClient) return; // Don't run on server-side

    const startConnection = async () => {
      try {
        // Get local media stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Connect to signaling server
        const socket = io(SIGNALING_SERVER, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        });
        socketRef.current = socket;
        
        // Set up socket event handlers
        socket.on('connect', () => {
          console.log('Connected to signaling server');
          setIsConnecting(false);
          
          // Tell server we're waiting for a match
          socket.emit('waiting', {
            walletAddress: publicKey?.toString() || 'unknown'
          });
        });
        
        socket.on('connect_error', (err) => {
          setError(`Failed to connect to signaling server: ${err.message}`);
        });
        
        socket.on('matched', ({ peer, peerWallet }) => {
          console.log(`Matched with peer: ${peer}`);
          setPeerWalletAddress(peerWallet);
          
          // Create WebRTC connection
          createPeerConnection(peer);
        });
        
        socket.on('offer', async ({ from, offer }) => {
          console.log(`Received offer from: ${from}`);
          if (!peerConnectionRef.current) {
            createPeerConnection(from);
          }
          
          await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(offer));
          
          // Create answer
          const answer = await peerConnectionRef.current?.createAnswer();
          await peerConnectionRef.current?.setLocalDescription(answer);
          
          // Send answer to peer
          socket.emit('answer', {
            to: from,
            answer
          });
        });
        
        socket.on('answer', async ({ from, answer }) => {
          console.log(`Received answer from: ${from}`);
          await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
        });
        
        socket.on('ice-candidate', async ({ from, candidate }) => {
          console.log(`Received ICE candidate from: ${from}`);
          try {
            await peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
        });
        
        socket.on('chat-ended', ({ reason }) => {
          console.log(`Chat ended: ${reason}`);
          cleanupAndReset();
          
          // Notify parent component
          onEndChat();
        });
        
      } catch (err) {
        setError("Couldn't access camera and microphone");
        console.error(err);
      }
    };
    
    startConnection();
    
    // Cleanup function
    return () => {
      cleanupAndReset();
    };
  }, []); // Empty dependency array - only run once on mount
  
  const createPeerConnection = (peerId: string) => {
    try {
      const configuration: RTCConfiguration = { 
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ] 
      };
      
      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;
      
      // Add local tracks to the connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          if (localStreamRef.current) {
            peerConnection.addTrack(track, localStreamRef.current);
          }
        });
      }
      
      // Set up event handlers for the peer connection
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit('ice-candidate', {
            to: peerId,
            candidate: event.candidate
          });
        }
      };
      
      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };
      
      peerConnection.onconnectionstatechange = () => {
        switch (peerConnection.connectionState) {
          case 'connected':
            setIsConnecting(false);
            setIsConnected(true);
            
            // Notify parent component
            onPeerConnect(peerConnection, peerWalletAddress);
            break;
          case 'disconnected':
          case 'failed':
          case 'closed':
            cleanupAndReset();
            break;
        }
      };
      
      // If we're the one initiating (matching happened and we should create offer)
      if (peerWalletAddress) {
        createAndSendOffer(peerId);
      }
      
    } catch (err) {
      setError("Failed to create peer connection");
      console.error(err);
    }
  };
  
  const createAndSendOffer = async (peerId: string) => {
    try {
      if (!peerConnectionRef.current) return;
      
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      socketRef.current?.emit('offer', {
        to: peerId,
        offer
      });
    } catch (err) {
      console.error('Error creating offer:', err);
    }
  };
  
  const cleanupAndReset = () => {
    // Stop all media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    // Reset state
    setIsConnecting(true);
    setIsConnected(false);
    setPeerWalletAddress('');
  };
  
  const handleEndChat = () => {
    socketRef.current?.emit('end-chat');
    cleanupAndReset();
    onEndChat();
  };
  
  return (
    <div className="video-chat">
      {error && (
        <div className="mb-4 p-3 bg-red-700 text-white rounded">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          {isClient && (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-lg bg-black"
            />
          )}
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
          
          {isClient && (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg bg-black"
            />
          )}
          
          {isConnected && (
            <>
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-sm px-2 py-1 rounded">
                Peer {peerWalletAddress.slice(0, 6)}...
              </div>
              
              <div className="absolute bottom-2 right-2">
                <TipButton recipientAddress={peerWalletAddress} />
              </div>
            </>
          )}
        </div>
      </div>
      
      <div className="mt-6 flex justify-center">
        <button 
          onClick={handleEndChat}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300"
        >
          End Chat
        </button>
      </div>
    </div>
  );
};

export default VideoChat;