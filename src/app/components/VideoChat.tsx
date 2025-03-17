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
  targetUserId?: string | null; // Optional: specific user to connect with
}

// Function to get correct signaling server URL
const getSignalingServer = () => {
  const serverUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER || 
    (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
      ? 'http://localhost:3001' 
      : 'https://solana-video-chat-signaling.onrender.com');
      
  // Ensure we're always using https in production
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && 
      !serverUrl.startsWith('https://') && !serverUrl.includes('localhost')) {
    return serverUrl.replace('http://', 'https://');
  }
  
  return serverUrl;
};

const VideoChat: FC<VideoChatProps> = ({ onPeerConnect, onEndChat, targetUserId }) => {
  const { publicKey } = useWallet();
  const [isConnecting, setIsConnecting] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [peerWalletAddress, setPeerWalletAddress] = useState<string>('');
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  const MAX_RETRIES = 5; // Increased retries
  
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

  const connectToSignalingServer = async () => {
    try {
      // Ensure we're using the correct URL with proper protocol
      const serverUrl = getSignalingServer();
      
      console.log('Attempting to connect to signaling server:', serverUrl);

      // Clear any existing socket connection
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.close();
      }
      
      // Improved socket.io configuration with more debug options
      const socket = io(serverUrl, {
        transports: ['polling', 'websocket'], // Try polling first, then websocket (more reliable)
        reconnection: true,
        reconnectionAttempts: MAX_RETRIES,
        reconnectionDelay: 1000,
        timeout: 20000,
        withCredentials: false, // Disable credentials for CORS
        forceNew: true, // Force a new connection
        autoConnect: true,
        path: '/socket.io/', // Explicitly set the path
        query: {
          walletAddress: publicKey?.toString() || 'unknown',
          clientTime: Date.now(), // Add timestamp for debugging
          // If we have a targetUserId, we're doing a direct connection
          ...(targetUserId ? { targetUserId, mode: 'direct' } : { mode: 'random' })
        }
      });

      // Add transport error event handling
      socket.io.on("error", (error) => {
        console.error("Socket.io transport error:", error);
        setError(`Transport error: ${error.message || 'Unknown error'}`);
      });

      socket.io.on("reconnect_attempt", () => {
        console.log("Socket transport reconnect attempt");
      });

      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('Connected to signaling server successfully');
        
        setIsConnecting(false);
        setIsConnected(true);
        setRetryCount(0);
        setError(null);
        
        // Tell server we're waiting for a match
        if (!targetUserId) {
          socket.emit('waiting', {
            walletAddress: publicKey?.toString() || 'unknown',
            timestamp: Date.now()
          });
        }
        // For direct connections, the server should handle it based on the query params
      });

      // Set up all event handlers
      setupSocketEventHandlers(socket);
      
    } catch (err) {
      console.error('Error in connectToSignalingServer:', err);
      setError(`Failed to establish connection to signaling server: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  // Extract event handler setup to a separate function to avoid duplication
  const setupSocketEventHandlers = (socket: Socket) => {
    socket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      let errorMessage = `Failed to connect to signaling server: ${err.message}`;
      
      // Provide more helpful error messages based on common issues
      if (err.message === 'timeout') {
        errorMessage = 'Connection to server timed out. The server might be down or overloaded.';
      } else if (err.message.includes('CORS')) {
        errorMessage = 'Cross-Origin Request blocked. This might be a browser security setting.';
      } else if (err.message.includes('xhr poll error')) {
        errorMessage = 'Network connection issue. Please check your internet connection.';
      }
      
      setError(errorMessage);
      setIsConnected(false);
      
      // Attempt to reconnect if we haven't exceeded max retries
      if (retryCount < MAX_RETRIES) {
        reconnectTimeoutRef.current = setTimeout(() => {
          setRetryCount(prev => prev + 1);
          socket.connect(); // Try to reconnect this socket instead of creating a new one
        }, 2000);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected from signaling server:', reason);
      setIsConnected(false);
      
      if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'transport error') {
        // Server initiated disconnect or transport closed, try to reconnect
        console.log('Attempting to reconnect after disconnect');
        socket.connect();
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
      setError(`Socket error: ${error.message || 'Unknown error'}`);
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber}`);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
      setError(null);
      setIsConnected(true);
      setIsConnecting(false);
      
      // Re-emit waiting status
      socket.emit('waiting', {
        walletAddress: publicKey?.toString() || 'unknown',
        timestamp: Date.now()
      });
    });

    socket.on('matched', ({ peer, peerWallet }) => {
      console.log(`Matched with peer: ${peer}`);
      setPeerWalletAddress(peerWallet);
      
      // Create the peer connection
      createPeerConnection(peer);
    });

    socket.on('offer', async ({ from, offer }) => {
      console.log(`Received offer from: ${from}`);
      if (!peerConnectionRef.current) {
        createPeerConnection(from);
      }
      
      try {
        await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnectionRef.current?.createAnswer();
        await peerConnectionRef.current?.setLocalDescription(answer);
        
        socket.emit('answer', {
          to: from,
          answer
        });
      } catch (error) {
        console.error('Error handling received offer:', error);
        setError('Failed to process connection offer. Try refreshing the page.');
      }
    });

    socket.on('answer', async ({ from, answer }) => {
      console.log(`Received answer from: ${from}`);
      try {
        await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Error setting remote description from answer:', error);
        setError('Failed to establish peer connection. Try refreshing the page.');
      }
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
  };

  // Connect to signaling server and set up media
  useEffect(() => {
    if (!isMounted || !publicKey) return;

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
        
        const errorMessage = err instanceof Error 
          ? err.message
          : "Couldn't access camera and microphone. Please make sure you have granted the necessary permissions.";
          
        setError(errorMessage);
      }
    };
    
    startConnection();
    
    // Cleanup function
    return () => {
      mounted = false;
      cleanupAndReset();
    };
  }, [isMounted, publicKey, onPeerConnect, onEndChat, targetUserId]);
  const createPeerConnection = (peerId: string) => {
    try {
      console.log('Creating peer connection with:', peerId);
      
      const configuration: RTCConfiguration = { 
        iceServers: [
          // Google's public STUN servers
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          
          // Free TURN servers (openrelay)
          { 
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all'
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
        logConnectionState(); // Log full state on any change
        
        switch (peerConnection.iceConnectionState) {
          case 'connected':
          case 'completed':
            console.log('ICE connection established');
            break;
          case 'disconnected':
            console.log('ICE connection disconnected - this may be temporary');
            // Don't reset immediately for disconnected, as it might recover
            break;
          case 'failed':
            console.log('ICE connection failed - attempting restart');
            // Try ICE restart
            peerConnection.restartIce();
            break;
          case 'closed':
            console.log('ICE connection closed');
            cleanupAndReset();
            break;
        }
      };
      
      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state changed:', peerConnection.connectionState);
        
        switch (peerConnection.connectionState) {
          case 'connected':
            console.log('Peer connection established');
            setIsConnecting(false);
            setIsConnected(true);
            break;
          case 'disconnected':
            console.log('Peer connection disconnected');
            break;
          case 'failed':
            console.log('Peer connection failed - attempting to reconnect');
            // Try to restart ICE
            peerConnection.restartIce();
            break;
          case 'closed':
            console.log('Peer connection closed');
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
      
      // Wait a short time for ICE gathering before sending
      setTimeout(() => {
        if (!peerConnectionRef.current || !socketRef.current) return;
        
        socketRef.current.emit('offer', {
          to: peerId,
          offer: peerConnectionRef.current.localDescription
        });
        console.log('Sent offer after timeout');
      }, 1000);
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
    // Normal end chat flow
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
        <div className="mb-4 p-3 bg-sonic-red/20 border border-sonic-red rounded-lg text-white">
          <p className="font-bold">Connection Error:</p>
          <p>{error}</p>
          {retryCount < MAX_RETRIES ? (
            <div className="mt-2 text-sm">
              Retrying connection... ({retryCount + 1}/{MAX_RETRIES})
            </div>
          ) : (
            <div className="mt-2 text-sm">
              <p>Connection attempts failed. You can try:</p>
              <ul className="list-disc pl-5 mt-1">
                <li>Refreshing the page</li>
                <li>Checking your internet connection</li>
                <li>Trying a different browser</li>
                <li>Disabling any VPN or proxy services</li>
                <li>Trying again later if the server is down</li>
              </ul>
              <button 
                onClick={() => {
                  setRetryCount(0);
                  setError(null);
                  connectToSignalingServer();
                }}
                className="mt-2 px-4 py-2 bg-sonic-blue hover:bg-sonic-blue-dark rounded-lg font-bold"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Connection Status Indicator */}
      <div className="mb-4 text-center">
        {isConnecting && !error && (
          <div className="inline-flex items-center px-4 py-2 bg-sonic-yellow bg-opacity-20 text-sonic-yellow rounded-full">
            <div className="w-2 h-2 bg-sonic-yellow rounded-full mr-2 animate-pulse"></div>
            Connecting to server...
          </div>
        )}
        {isConnected && !isConnecting && (
          <div className="inline-flex items-center px-4 py-2 bg-sonic-green bg-opacity-20 text-sonic-green rounded-full">
            <div className="w-2 h-2 bg-sonic-green rounded-full mr-2 animate-pulse"></div>
            Connected to peer
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Local Video */}
        <div className="relative group rounded-xl overflow-hidden shadow-2xl transform transition-all duration-300 hover:scale-[1.02] border-2 border-gray-700">
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
        <div className="relative group rounded-xl overflow-hidden shadow-2xl transform transition-all duration-300 hover:scale-[1.02] border-2 border-gray-700">
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-sonic-blue mx-auto mb-4"></div>
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
              ? 'bg-sonic-red hover:bg-sonic-red-dark' 
              : 'bg-sonic-blue hover:bg-sonic-blue-dark'
          } text-white shadow-lg hover:shadow-xl transform hover:scale-110`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <FaMicrophoneSlash size={24} /> : <FaMicrophone size={24} />}
        </button>

        <button 
          onClick={toggleVideo}
          className={`p-4 rounded-full transition-all duration-300 ${
            isVideoOff 
              ? 'bg-sonic-red hover:bg-sonic-red-dark' 
              : 'bg-sonic-blue hover:bg-sonic-blue-dark'
          } text-white shadow-lg hover:shadow-xl transform hover:scale-110`}
          title={isVideoOff ? "Turn on camera" : "Turn off camera"}
        >
          {isVideoOff ? <FaVideoSlash size={24} /> : <FaVideo size={24} />}
        </button>

        <button 
          onClick={handleEndChat}
          className="p-4 rounded-full bg-sonic-red hover:bg-sonic-red-dark text-white shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300"
          title="End Chat"
        >
          <FaPhoneSlash size={24} />
        </button>
      </div>
    </div>
  );
};

export default VideoChat;
  