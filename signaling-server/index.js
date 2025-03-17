// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
// Create the HTTP server first
const server = http.createServer(app);

// Define allowed origins - being more permissive to fix CORS issues
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'https://omegle-alpha.vercel.app',
  'https://*.vercel.app',  // Allow all Vercel subdomains
  '*' // Allow all origins in development
].filter(Boolean);

// Configure CORS for Express with specific options
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // In development, allow all origins
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        
        if (allowedOrigins.indexOf(origin) === -1 && !allowedOrigins.includes('*')) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Origin'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Add preflight handling middleware
app.options('*', cors());

// Configure Socket.io with improved CORS settings
const io = new Server(server, {
    cors: {
        origin: function(origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);
            
            // In development, allow all origins
            if (process.env.NODE_ENV !== 'production') {
                return callback(null, true);
            }
            
            if (allowedOrigins.indexOf(origin) === -1 && !allowedOrigins.includes('*')) {
                const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
                return callback(new Error(msg), false);
            }
            return callback(null, true);
        },
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Origin'],
        credentials: true,
        preflightContinue: false,
        optionsSuccessStatus: 204
    },
    // Add transport options to help with connection issues - prefer polling first
    transports: ['polling', 'websocket'],
    // Add ping timeout and interval to detect disconnections faster
    pingTimeout: 20000, // Increased timeout
    pingInterval: 10000, // Increased interval
    // Add path configuration
    path: '/socket.io/',
    // Add allowEIO3 option for better compatibility
    allowEIO3: true,
    // Add connectTimeout
    connectTimeout: 45000, // Increased timeout
    // Add cookie handling
    cookie: false // Disabled cookies to prevent issues
});

// Track available users waiting to be matched
const waitingUsers = new Map();
// Track active chat sessions
const activeSessions = new Map();
// Track online users (for lobby)
const onlineUsers = new Map();

// Define hardcoded user wallet address that you'll use to join
const HARDCODED_WALLET = '4W17DTAWGYmRWbKKajUw4YsPDGex3xBgyCKvLJSCb6dT';

// Add error event handling for Socket.io
io.on('error', (error) => {
    console.error('Socket.io server error:', error);
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    // Get connection mode and wallet information
    const mode = socket.handshake.query.mode || 'random';
    const walletAddress = socket.handshake.query.walletAddress || 'unknown';
    const walletProvider = socket.handshake.query.walletProvider || 'unknown';
    
    // Add user to online users
    const userInfo = {
        id: socket.id,
        socketId: socket.id,
        walletAddress,
        walletProvider,
        joinedAt: Date.now(),
        isBackpackWallet: walletProvider.toLowerCase().includes('backpack')
    };
    
    // Check if this is the hardcoded wallet
    const isHardcodedWallet = walletAddress === HARDCODED_WALLET;
    
    onlineUsers.set(socket.id, userInfo);
    
    // Handle lobby mode
    if (mode === 'lobby') {
        // Broadcast the new user to all other users
        socket.broadcast.emit('user_joined', userInfo);
        
        // Handle request for online users list
        socket.on('get_online_users', () => {
            const allUsers = Array.from(onlineUsers.values());
            socket.emit('online_users', allUsers);
        });
        
        // Handle initiating a chat from lobby with specific user
        socket.on('initiate_chat', ({ targetUserId }) => {
            console.log(`User ${socket.id} wants to chat with ${targetUserId}`);
            
            // Normal user-to-user chat setup
            const targetSocket = io.sockets.sockets.get(targetUserId);
            if (targetSocket) {
                // Get target user info
                const targetUser = onlineUsers.get(targetUserId);
                
                if (!targetUser) {
                    socket.emit('error', { message: 'Target user not found' });
                    return;
                }
                
                // Create a session ID
                const sessionId = `${socket.id}-${targetUserId}`;
                
                // Store the session
                activeSessions.set(sessionId, {
                    user1: socket.id,
                    user2: targetUserId,
                    user1Wallet: walletAddress,
                    user2Wallet: targetUser.walletAddress,
                    startedAt: Date.now()
                });
                
                // Notify both users
                socket.emit('matched', {
                    peer: targetUserId,
                    peerWallet: targetUser.walletAddress
                });
                
                targetSocket.emit('matched', {
                    peer: socket.id,
                    peerWallet: walletAddress
                });
                
                console.log(`Matched users from lobby: ${socket.id} and ${targetUserId}`);
            } else {
                socket.emit('error', { message: 'Selected user is no longer online' });
            }
        });
    }
    
    // User joins the waiting pool for random matching
    socket.on('waiting', (userData) => {
        try {
            const { walletAddress } = userData;
            console.log(`User ${socket.id} (${walletAddress}) is waiting for a match`);
            
            // Add user to waiting pool
            waitingUsers.set(socket.id, {
                socketId: socket.id,
                walletAddress,
                joinedAt: Date.now()
            });
            
            // Try to match with another user
            matchUsers();
        } catch (error) {
            console.error('Error in waiting event:', error);
            socket.emit('error', { message: 'Failed to enter waiting pool' });
        }
    });
    
    // Handle WebRTC signaling with error handling
    socket.on('offer', ({ to, offer }) => {
        try {
            io.to(to).emit('offer', { from: socket.id, offer });
        } catch (error) {
            console.error('Error sending offer:', error);
            socket.emit('error', { message: 'Failed to send offer' });
        }
    });
    
    socket.on('answer', ({ to, answer }) => {
        try {
            io.to(to).emit('answer', { from: socket.id, answer });
        } catch (error) {
            console.error('Error sending answer:', error);
            socket.emit('error', { message: 'Failed to send answer' });
        }
    });
    
    socket.on('ice-candidate', ({ to, candidate }) => {
        try {
            io.to(to).emit('ice-candidate', { from: socket.id, candidate });
        } catch (error) {
            console.error('Error sending ICE candidate:', error);
            socket.emit('error', { message: 'Failed to send ICE candidate' });
        }
    });
    
    // Handle chat ending
    socket.on('end-chat', () => {
        try {
            // Find any session involving this socket
            let sessionToEnd = null;
            let sessionIdToEnd = null;
            
            activeSessions.forEach((session, sessionId) => {
                if (session.user1 === socket.id || session.user2 === socket.id) {
                    sessionToEnd = session;
                    sessionIdToEnd = sessionId;
                }
            });
            
            if (sessionToEnd) {
                const otherUser = sessionToEnd.user1 === socket.id ? 
                    sessionToEnd.user2 : sessionToEnd.user1;
                
                // Notify the other user
                io.to(otherUser).emit('chat-ended', { 
                    reason: 'Peer ended the chat'
                });
                
                // Remove the session
                activeSessions.delete(sessionIdToEnd);
                console.log(`Chat session ${sessionIdToEnd} ended by user ${socket.id}`);
            }
        } catch (error) {
            console.error('Error ending chat:', error);
            socket.emit('error', { message: 'Failed to end chat properly' });
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        try {
            console.log(`User disconnected: ${socket.id}`);
            
            // Remove from online users list
            onlineUsers.delete(socket.id);
            
            // Broadcast user left to lobby
            socket.broadcast.emit('user_left', socket.id);
            
            // Remove from waiting pool if present
            if (waitingUsers.has(socket.id)) {
                waitingUsers.delete(socket.id);
                console.log(`Removed ${socket.id} from waiting pool`);
            }
            
            // End any active session
            let foundSession = false;
            activeSessions.forEach((session, sessionId) => {
                if (session.user1 === socket.id || session.user2 === socket.id) {
                    const otherUser = session.user1 === socket.id ? 
                        session.user2 : session.user1;
                    
                    // Notify the other user if they're still connected
                    if (io.sockets.sockets.has(otherUser)) {
                        io.to(otherUser).emit('chat-ended', { 
                            reason: 'Peer disconnected'
                        });
                        console.log(`Notified ${otherUser} about disconnection of ${socket.id}`);
                    }
                    
                    activeSessions.delete(sessionId);
                    foundSession = true;
                    console.log(`Ended session ${sessionId} due to disconnect`);
                }
            });
            
            if (foundSession) {
                console.log(`Cleaned up session for disconnected user ${socket.id}`);
            }
        } catch (error) {
            console.error('Error handling disconnect:', error);
        }
    });
    
    // Handle connection errors
    socket.on('error', (error) => {
        console.error(`Socket ${socket.id} error:`, error);
    });
});

// Function to match waiting users
function matchUsers() {
    try {
        if (waitingUsers.size >= 2) {
            // Sort users by waiting time (FIFO)
            const sortedUsers = [...waitingUsers.values()]
                .sort((a, b) => a.joinedAt - b.joinedAt);
            
            // Get the first two users
            const user1 = sortedUsers[0];
            const user2 = sortedUsers[1];
            
            // Verify both users are still connected
            if (!io.sockets.sockets.has(user1.socketId) || !io.sockets.sockets.has(user2.socketId)) {
                // Clean up any disconnected users
                if (!io.sockets.sockets.has(user1.socketId)) {
                    waitingUsers.delete(user1.socketId);
                    console.log(`Removed disconnected user ${user1.socketId} from waiting pool`);
                }
                if (!io.sockets.sockets.has(user2.socketId)) {
                    waitingUsers.delete(user2.socketId);
                    console.log(`Removed disconnected user ${user2.socketId} from waiting pool`);
                }
                // Try matching again with remaining users
                if (waitingUsers.size >= 2) {
                    matchUsers();
                }
                return;
            }
            
            // Remove them from waiting pool
            waitingUsers.delete(user1.socketId);
            waitingUsers.delete(user2.socketId);
            
            // Create a session ID
            const sessionId = `${user1.socketId}-${user2.socketId}`;
            
            // Store the session
            activeSessions.set(sessionId, {
                user1: user1.socketId,
                user2: user2.socketId,
                user1Wallet: user1.walletAddress,
                user2Wallet: user2.walletAddress,
                startedAt: Date.now()
            });
            
            // Notify both users that they've been matched
            io.to(user1.socketId).emit('matched', {
                peer: user2.socketId,
                peerWallet: user2.walletAddress
            });
            
            io.to(user2.socketId).emit('matched', {
                peer: user1.socketId,
                peerWallet: user1.walletAddress
            });
            
            console.log(`Matched users: ${user1.socketId} and ${user2.socketId}`);
        }
    } catch (error) {
        console.error('Error in matchUsers function:', error);
    }
}

// Add HTTP/1.1 headers to improve WebSocket support
app.use((req, res, next) => {
    res.header('Connection', 'keep-alive');
    res.header('Keep-Alive', 'timeout=30');
    next();
});

// Add a health check route with more details
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Signaling server is running',
        connections: io.sockets.sockets.size,
        waitingUsers: waitingUsers.size,
        activeSessions: activeSessions.size,
        onlineUsers: onlineUsers.size,
        version: '1.1.0'
    });
});

// Start the server with error handling
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
}).on('error', (error) => {
    console.error('Server failed to start:', error);
});

// Handle process termination gracefully
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
    console.log('Shutting down server...');
    // Close all socket connections
    io.close(() => {
        console.log('All socket connections closed');
        // Close the HTTP server
        server.close(() => {
            console.log('HTTP server closed');
            process.exit(0);
        });
    });
    
    // Force exit after 5 seconds if graceful shutdown fails
    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 5000);
}