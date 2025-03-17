// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
// Create the HTTP server first
const server = http.createServer(app);

// Define allowed origins
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'https://omegle-alpha.vercel.app'
].filter(Boolean);

// Configure CORS for Express
app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ["*"],
    credentials: true
}));

// Configure Socket.io with improved CORS settings
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        allowedHeaders: ["*"],
        credentials: true
    },
    // Add transport options to help with connection issues
    transports: ['websocket', 'polling'],
    // Add ping timeout and interval to detect disconnections faster
    pingTimeout: 10000,
    pingInterval: 5000
});

// Track available users waiting to be matched
const waitingUsers = new Map();
// Track active chat sessions
const activeSessions = new Map();

// Add error event handling for Socket.io
io.on('error', (error) => {
    console.error('Socket.io server error:', error);
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    // User joins the waiting pool
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

// Add a health check route with more details
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Signaling server is running',
        connections: io.sockets.sockets.size,
        waitingUsers: waitingUsers.size,
        activeSessions: activeSessions.size
    });
});

// Start the server with error handling
const PORT = process.env.PORT || 4000;
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