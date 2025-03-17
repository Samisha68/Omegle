# Signaling Server Updates for Lobby Functionality with Sonic Wallet Support

This document outlines the necessary changes to implement the lobby functionality on your signaling server with support for Sonic wallets.

## New Server-Side Functionality Required

Add these event handlers to your signaling server:

```javascript
// Track online users
const onlineUsers = new Map();

// When a user connects
io.on('connection', (socket) => {
  const walletAddress = socket.handshake.query.walletAddress;
  const walletProvider = socket.handshake.query.walletProvider || 'unknown'; // Add this for Sonic wallet detection
  const mode = socket.handshake.query.mode || 'random';
  const targetUserId = socket.handshake.query.targetUserId;
  
  // Add user to online users list with a unique ID
  const userId = socket.id;
  
  // Store user info - now including wallet provider
  const userInfo = {
    id: userId,
    walletAddress,
    walletProvider, // Store wallet provider name
    joinedAt: Date.now()
  };
  
  onlineUsers.set(userId, userInfo);
  
  // Handle lobby mode
  if (mode === 'lobby') {
    // Broadcast new user to everyone in lobby
    socket.broadcast.emit('user_joined', userInfo);
    
    // Handle request for online users
    socket.on('get_online_users', () => {
      socket.emit('online_users', Array.from(onlineUsers.values()));
    });
    
    // Handle initiate chat request
    socket.on('initiate_chat', ({ targetUserId }) => {
      const targetSocket = io.sockets.sockets.get(targetUserId);
      if (targetSocket) {
        // Notify target user about the chat request
        targetSocket.emit('chat_request', {
          from: userId,
          walletAddress,
          walletProvider
        });
      }
    });
  }
  
  // Handle direct connection mode
  if (mode === 'direct' && targetUserId) {
    const targetSocket = io.sockets.sockets.get(targetUserId);
    if (targetSocket) {
      const targetUser = onlineUsers.get(targetUserId);
      // Set up direct connection between the two users
      socket.emit('matched', {
        peer: targetUserId,
        peerWallet: targetUser?.walletAddress || 'unknown',
        peerWalletProvider: targetUser?.walletProvider // Include wallet provider info
      });
      
      targetSocket.emit('matched', {
        peer: userId,
        peerWallet: walletAddress,
        peerWalletProvider: walletProvider
      });
    } else {
      // Target user not found
      socket.emit('error', { message: 'Target user not found or offline' });
    }
  }
  
  // Handle random matching (existing logic)
  if (mode === 'random') {
    // Your existing code for random matching
    socket.on('waiting', (data) => {
      // Existing waiting queue handling
    });
  }
  
  // Handle disconnection
  socket.on('disconnect', () => {
    // Remove from online users
    onlineUsers.delete(userId);
    
    // Notify others in lobby
    socket.broadcast.emit('user_left', userId);
    
    // Handle existing cleanup logic
  });
});
```

## Features Implemented

1. **Online Users Tracking**: The server keeps track of all connected users in a Map
2. **Lobby Mode**: Users can join a lobby and see who else is online
3. **Direct Connections**: Users can initiate chats directly with specific users
4. **Random Matching**: Original functionality is preserved
5. **Real-time Updates**: Users get notified when others join or leave
6. **Sonic Wallet Detection**: The server now tracks which wallet provider each user is using
7. **Filtering Capability**: Clients can filter users based on their wallet type

## Sonic Wallet Integration

The implementation now tracks the wallet provider for each connected user, enabling:

1. **Sonic Wallet Badges**: Users with Sonic-compatible wallets (Backpack, OKX Web3, Nightly, Bybit) get special badges
2. **Filtering**: The lobby UI allows filtering to show only Sonic wallet users
3. **Enhanced Matching**: The client can offer special features for Sonic-to-Sonic wallet connections

## Notes

- This implementation preserves all existing functionality while adding the new wallet-aware features
- The same signaling server handles both random and direct connections
- User anonymity is maintained by only sharing wallet addresses, not personal info
- Client-side handles the actual display names to keep them anonymous

Update your signaling server with these changes to support the new lobby functionality with Sonic wallet integration. 