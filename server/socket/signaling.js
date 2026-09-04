// Socket.IO signaling server (mesh topology, capped — mesh degrades past ~6 peers, use SFU beyond).
// Lifecycle: join-room -> user-connected -> offer -> answer -> ice-candidate -> (media flows P2P)
//            send-message (chat relay) | disconnect -> user-disconnected
const MAX_PEERS = parseInt(process.env.MAX_PEERS || '6', 10);
function setupSignaling(io) {
  // Track which rooms each socket joined for clean disconnect broadcast
  const socketRooms = new Map(); // socket.id -> Set(roomId)

  io.on('connection', (socket) => {
    // 1. JOIN: client wants to enter a room (reject when full to protect mesh quality)
    socket.on('join-room', ({ roomId, userId, userName }) => {
      const size = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      if (size >= MAX_PEERS) return socket.emit('room-full', { roomId, max: MAX_PEERS });
      socket.join(roomId);
      if (!socketRooms.has(socket.id)) socketRooms.set(socket.id, new Set());
      socketRooms.get(socket.id).add(roomId);
      socket.data.userId = userId;
      socket.data.userName = userName;

      // Tell everyone ELSE in the room a new peer arrived (they will each send an offer)
      socket.to(roomId).emit('user-connected', { userId, userName, socketId: socket.id });
    });

    // 2/3. SDP RELAY: forward offer/answer to one specific peer (1:1, not broadcast)
    socket.on('offer', ({ targetSocketId, offer, from }) => {
      io.to(targetSocketId).emit('offer', { offer, from });
    });
    socket.on('answer', ({ targetSocketId, answer, from }) => {
      io.to(targetSocketId).emit('answer', { answer, from });
    });

    // 4. ICE RELAY: trickle candidates as they are discovered
    socket.on('ice-candidate', ({ targetSocketId, candidate, from }) => {
      io.to(targetSocketId).emit('ice-candidate', { candidate, from });
    });

    // 5. CHAT: broadcast to room (including sender echo handled client-side)
    socket.on('send-message', ({ roomId, message }) => {
      // message = { id, sender, senderName, text, time }
      socket.to(roomId).emit('receive-message', message);
    });

    // 6. LEAVE: explicit leave (End Call) + implicit disconnect both notify peers
    const leaveAll = () => {
      const rooms = socketRooms.get(socket.id) || new Set();
      rooms.forEach((roomId) => {
        socket.to(roomId).emit('user-disconnected', { socketId: socket.id, userId: socket.data.userId });
      });
      socketRooms.delete(socket.id);
    };
    socket.on('leave-room', ({ roomId }) => {
      socket.leave(roomId);
      socket.to(roomId).emit('user-disconnected', { socketId: socket.id, userId: socket.data.userId });
      socketRooms.get(socket.id)?.delete(roomId);
    });
    socket.on('disconnect', leaveAll);
  });
}

module.exports = setupSignaling;
