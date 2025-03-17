// src/components/VideoChat.tsx
"use client"
import { useState, useEffect, useRef, FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import TipButton from './TipButton';
import { io, Socket } from 'socket.io-client';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhoneSlash } from 'react-icons/fa';

interface VideoChatProps {
  onPeerConnect: (connection: RTCPeerConnection, walletAddress: string) => void;
  onEndChat: () => void;
}

// Update the signaling server URL to use the correct port
const SIGNALING_SERVER = process.env.NEXT_PUBLIC_SIGNALING_SERVER || 'https://solana-video-chat-signaling.onrender.com';

const VideoChat: FC<VideoChatProps> = ({ onPeerConnect, onEndChat }) => {
  const { publicKey } = useWallet();
  const [isConnecting, setIsConnecting] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [peerWalletAddress, setPeerWalletAddress] = useState<string>('');
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  const MAX_RETRIES = 3;
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [isHovering, setIsHovering] = useState<boolean>(false);

  // Handle component mounting
  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const connectToSignalingServer = () => {
    try {
      console.log('Attempting to connect to signaling server:', SIGNALING_SERVER);
      
      // Simplified Socket.IO configuration that focuses on reliability
      const socket = io(SIGNALING_SERVER, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: MAX_RETRIES,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        query: {
          walletAddress: publicKey?.toString() || 'unknown'
        }
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Connected to signaling server successfully');
        setIsConnecting(false);
        setIsConnected(true);
        setRetryCount(0);
        setError(null);
        
        // Tell server we're waiting for a match
        socket.emit('waiting', {
          walletAddress: publicKey?.toString() || 'unknown',
          timestamp: Date.now()
        });
      });

      socket.on('connect_error', (err) => {
        console.error('Connection error:', err);
        setError(`Failed to connect to signaling server: ${err.message}`);
        setIsConnected(false);
        
        // Attempt to reconnect if we haven't exceeded max retries
        if (retryCount < MAX_RETRIES) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setRetryCount(prev => prev + 1);
            connectToSignalingServer();
          }, 2000);
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('Disconnected from signaling server:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, try to reconnect
          socket.connect();
        }
      });

      socket.on('matched', ({ peer, peerWallet }) => {
        console.log(`Matched with peer: ${peer}`);
        setPeerWalletAddress(peerWallet);
        createPeerConnection(peer);
      });

      socket.on('offer', async ({ from, offer }) => {
        console.log(`Received offer from: ${from}`);
        if (!peerConnectionRef.current) {
          createPeerConnection(from);
        }
        
        await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnectionRef.current?.createAnswer();
        await peerConnectionRef.current?.setLocalDescription(answer);
        
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
        onEndChat();
      });

    } catch (err) {
      console.error('Error in connectToSignalingServer:', err);
      setError("Failed to establish connection to signaling server");
    }
  };

  // Connect to signaling server and set up media
  useEffect(() => {
    if (!isMounted) return;

    let mounted = true;

    const startConnection = async () => {
      try {
        // Get local media stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Connect to signaling server
        connectToSignalingServer();
        
      } catch (err) {
        if (!mounted) return;
        console.error('Error in startConnection:', err);
        setError("Couldn't access camera and microphone. Please make sure you have granted the necessary permissions.");
      }
    };
    
    startConnection();
    
    // Cleanup function
    return () => {
      mounted = false;
      cleanupAndReset();
    };
  }, [isMounted, publicKey, onPeerConnect, onEndChat, retryCount]);
  
  const createPeerConnection = (peerId: string) => {
    try {
      console.log('Creating peer connection with:', peerId);
      
      const configuration: RTCConfiguration = { 
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { 
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        iceCandidatePoolSize: 10
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
          console.log('New ICE candidate:', event.candidate.type);
          socketRef.current?.emit('ice-candidate', {
            to: peerId,
            candidate: event.candidate
          });
        }
      };
      
      peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
        switch (peerConnection.iceConnectionState) {
          case 'connected':
            console.log('ICE connection established');
            break;
          case 'disconnected':
          case 'failed':
          case 'closed':
            console.log('ICE connection failed or closed');
            cleanupAndReset();
            break;
        }
      };
      
      peerConnection.ontrack = (event) => {
        console.log('Received remote track');
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setIsConnecting(false);
          setIsConnected(true);
          onPeerConnect(peerConnection, peerWalletAddress);
        }
      };
      
      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state changed:', peerConnection.connectionState);
        switch (peerConnection.connectionState) {
          case 'connected':
            console.log('Peer connection established');
            setIsConnecting(false);
            setIsConnected(true);
            onPeerConnect(peerConnection, peerWalletAddress);
            break;
          case 'disconnected':
          case 'failed':
          case 'closed':
            console.log('Peer connection failed or closed');
            cleanupAndReset();
            break;
        }
      };
      
      // If we're the one initiating (matching happened and we should create offer)
      if (peerWalletAddress) {
        createAndSendOffer(peerId);
      }
      
    } catch (err) {
      console.error('Error creating peer connection:', err);
      setError("Failed to create peer connection");
    }
  };
  
  const createAndSendOffer = async (peerId: string) => {
    try {
      if (!peerConnectionRef.current) return;
      
      console.log('Creating and sending offer to:', peerId);
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await peerConnectionRef.current.setLocalDescription(offer);
      
      // Wait for ICE gathering to complete before sending the offer
      if (peerConnectionRef.current.iceGatheringState === 'complete') {
        socketRef.current?.emit('offer', {
          to: peerId,
          offer: peerConnectionRef.current.localDescription
        });
      } else {
        // Wait for ICE gathering to complete
        const checkState = () => {
          if (peerConnectionRef.current?.iceGatheringState === 'complete') {
            socketRef.current?.emit('offer', {
              to: peerId,
              offer: peerConnectionRef.current.localDescription
            });
            return true;
          }
          return false;
        };
        
        if (!checkState()) {
          // Set a timeout in case ICE gathering takes too long
          setTimeout(() => {
            if (peerConnectionRef.current?.localDescription) {
              socketRef.current?.emit('offer', {
                to: peerId,
                offer: peerConnectionRef.current.localDescription
              });
              console.log('Sent offer after timeout');
            }
          }, 5000);
        }
      }
    } catch (err) {
      console.error('Error creating offer:', err);
      setError("Failed to create connection offer");
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
  
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!isMuted);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!isVideoOff);
      }
    }
  };

  // Add this new function to help with debugging
  const logConnectionState = () => {
    if (!peerConnectionRef.current) return;
    
    console.log('Connection debug info:');
    console.log('- ICE Connection State:', peerConnectionRef.current.iceConnectionState);
    console.log('- ICE Gathering State:', peerConnectionRef.current.iceGatheringState);
    console.log('- Signaling State:', peerConnectionRef.current.signalingState);
    console.log('- Connection State:', peerConnectionRef.current.connectionState);
    
    // Check for remote streams
    const receivers = peerConnectionRef.current.getReceivers();
    console.log('- Remote streams:', receivers.length);
    
    // Log socket connection state
    console.log('- Socket connected:', socketRef.current?.connected);
  };

  useEffect(() => {
    if (peerConnectionRef.current && isConnected) {
      // Log connection state every 5 seconds for debugging
      const interval = setInterval(logConnectionState, 5000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  return (
    <div className="video-chat relative">
      {error && (
        <div className="mb-4 p-3 bg-red-700 text-white rounded-lg shadow-lg">
          {error}
          {retryCount < MAX_RETRIES && (
            <div className="mt-2 text-sm">
              Retrying connection... ({retryCount + 1}/{MAX_RETRIES})
            </div>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Local Video */}
        <div className="relative group rounded-xl overflow-hidden shadow-2xl transform transition-all duration-300 hover:scale-[1.02]">
          {isMounted && (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full aspect-video object-cover"
            />
          )}
          <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 text-white px-4 py-2 rounded-full backdrop-blur-sm">
            You {publicKey?.toString().slice(0, 6)}...
          </div>
          {isVideoOff && (
            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
              <div className="text-white text-2xl">Camera Off</div>
            </div>
          )}
        </div>
        
        {/* Remote Video */}
        <div className="relative group rounded-xl overflow-hidden shadow-2xl transform transition-all duration-300 hover:scale-[1.02]">
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500 mx-auto mb-4"></div>
                <p className="text-white text-lg">Finding someone to chat with...</p>
                <p className="text-gray-400 text-sm mt-2">This might take a few moments</p>
              </div>
            </div>
          )}
          
          {isMounted && (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full aspect-video object-cover"
            />
          )}
          
          {isConnected && (
            <>
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 text-white px-4 py-2 rounded-full backdrop-blur-sm">
                Peer {peerWalletAddress.slice(0, 6)}...
              </div>
              
              <div className="absolute bottom-4 right-4">
                <TipButton recipientAddress={peerWalletAddress} />
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Controls Bar */}
      <div className="mt-8 flex justify-center items-center space-x-4">
        <button 
          onClick={toggleMute}
          className={`p-4 rounded-full transition-all duration-300 ${
            isMuted 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-purple-600 hover:bg-purple-700'
          } text-white shadow-lg hover:shadow-xl transform hover:scale-110`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <FaMicrophoneSlash size={24} /> : <FaMicrophone size={24} />}
        </button>

        <button 
          onClick={toggleVideo}
          className={`p-4 rounded-full transition-all duration-300 ${
            isVideoOff 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-purple-600 hover:bg-purple-700'
          } text-white shadow-lg hover:shadow-xl transform hover:scale-110`}
          title={isVideoOff ? "Turn on camera" : "Turn off camera"}
        >
          {isVideoOff ? <FaVideoSlash size={24} /> : <FaVideo size={24} />}
        </button>

        <button 
          onClick={handleEndChat}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300"
          title="End Chat"
        >
          <FaPhoneSlash size={24} />
        </button>
      </div>

      {/* Connection Status */}
      {isConnected && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-green-500 bg-opacity-20 text-green-500 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            Connected
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoChat;