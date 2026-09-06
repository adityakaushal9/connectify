// WebRTC mesh context — owns socket + all peer connections + local media.
// Lifecycle per peer: getUserMedia -> join-room -> user-connected -> offer -> answer -> ICE -> P2P media
import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const WebRTCContext = createContext(null);
export const useWebRTC = () => useContext(WebRTCContext);

// Google STUN works for most NATs; add TURN via VITE_TURN_URL for strict networks
const DEFAULT_ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

function buildIceServers() {
  try {
    if (import.meta.env.VITE_ICE_SERVERS) {
      return JSON.parse(import.meta.env.VITE_ICE_SERVERS);
    }
  } catch {
    // fall through to defaults
  }

  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUser = import.meta.env.VITE_TURN_USER;
  const turnPass = import.meta.env.VITE_TURN_PASS;

  const servers = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (turnUrl && turnUser && turnPass) {
    servers.push({
      urls: turnUrl,
      username: turnUser,
      credential: turnPass,
    });
  }
  return servers;
}


export function WebRTCProvider({ children }) {
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState({}); // socketId -> { stream, userName }
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [isMicOn, setMicOn] = useState(true);
  const [isVideoOn, setVideoOn] = useState(true);
  const [isSharing, setSharing] = useState(false);
  const [roomId, setRoomId] = useState(null);

  const socketRef = useRef(null);
  const pcsRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const localRef = useRef(null); // current local MediaStream
  const camTrackRef = useRef(null); // backup camera track for screen-share revert
  const screenTrackRef = useRef(null);
  const roomRef = useRef(null);
  const identityRef = useRef({ userId: '', userName: 'Guest' });

  // --- STEP 0: capture local media (video+audio, fallback to audio-only) ---
  const ensureMedia = useCallback(async () => {
    if (localRef.current) return localRef.current;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      camTrackRef.current = s.getVideoTracks()[0] || null;
      localRef.current = s;
      setLocalStream(s);
      return s;
    } catch {
      // Camera denied/blocked -> still join with mic so call isn't dead
      const s = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      setVideoOn(false);
      localRef.current = s;
      setLocalStream(s);
      return s;
    }
  }, []);

  // --- Create one RTCPeerConnection per remote peer, wire local tracks + remote stream ---
  const createPC = useCallback((remoteSocketId, remoteName) => {
    if (pcsRef.current.has(remoteSocketId)) return pcsRef.current.get(remoteSocketId);
    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });

    // Attach local tracks so remote sees us
    localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current));

    // Remote media arrives here -> store per-peer stream for <video> grid
    pc.ontrack = (e) => {
      const [stream] = e.streams;
      setPeers((p) => ({ ...p, [remoteSocketId]: { stream, userName: remoteName || 'Guest' } }));
    };
    // Trickle our ICE candidates to that one peer via signaling server.
    // Log type: host = LAN, srflx = STUN public IP, relay = TURN (what you want on strict NATs)
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        console.log(`[ICE] ${e.candidate.type} via ${e.candidate.protocol}`, e.candidate.address || '');
        socketRef.current?.emit('ice-candidate', { targetSocketId: remoteSocketId, candidate: e.candidate, from: socketRef.current.id });
      }
    };
    // Auto ICE-restart on failure (common on WiFi switch / sleep)
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') pc.restartIce().catch(() => {});
      if (['closed', 'failed', 'disconnected'].includes(pc.iceConnectionState)) {
        // keep tile until user-disconnected cleans it up
      }
    };
    pcsRef.current.set(remoteSocketId, pc);
    return pc;
  }, []);

  // --- STEP 1: join a room (connect socket once, then announce presence) ---
  const joinRoom = useCallback(async (rid, { userId, userName }) => {
    await ensureMedia();
    identityRef.current = { userId, userName };
    roomRef.current = rid;
    setRoomId(rid);

    if (!socketRef.current) {
      const s = io(SERVER_URL, { autoConnect: true, reconnection: true });
      socketRef.current = s;

      // A new peer joined AFTER us -> we (existing member) initiate the offer
      s.on('user-connected', async ({ socketId, userName: name }) => {
        const pc = createPC(socketId, name);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        s.emit('offer', { targetSocketId: socketId, offer, from: { socketId: s.id, userName: identityRef.current.userName } });
      });
      // Someone offers TO us -> answer back (accept remote SDP, send ours)
      s.on('offer', async ({ offer, from }) => {
        const pc = createPC(from.socketId, from.userName);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        s.emit('answer', { targetSocketId: from.socketId, answer, from: { socketId: s.id, userName: identityRef.current.userName } });
      });
      // Offerer receives answer -> finalize handshake
      s.on('answer', async ({ answer, from }) => {
        await pcsRef.current.get(from.socketId)?.setRemoteDescription(new RTCSessionDescription(answer));
      });
      // ICE trickle both directions
      s.on('ice-candidate', async ({ candidate, from }) => {
        try { await pcsRef.current.get(from.socketId)?.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* late/duplicate candidate */ }
      });
      // Peer left -> close PC + drop tile
      s.on('user-disconnected', ({ socketId }) => {
        pcsRef.current.get(socketId)?.close();
        pcsRef.current.delete(socketId);
        setPeers((p) => { const n = { ...p }; delete n[socketId]; return n; });
      });
      // Room cap: server rejects when mesh is full — surface it so UI can redirect
      s.on('room-full', ({ max }) => {
        alert(`Room is full (max ${max} peers in mesh mode). Try a new room.`);
        window.location.href = '/';
      });
      // Chat receive
      s.on('receive-message', (msg) => {
        setMessages((m) => [...m, msg]);
        setChatOpen((open) => { if (!open) setUnread((u) => u + 1); return open; });
      });
      // Socket dropped & reconnected -> re-announce so mesh rebuilds
      s.on('reconnect', () => {
        if (roomRef.current) s.emit('join-room', { roomId: roomRef.current, ...identityRef.current });
      });
    }
    socketRef.current.emit('join-room', { roomId: rid, userId, userName });
  }, [ensureMedia, createPC]);

  const leaveRoom = useCallback(() => {
    if (roomRef.current) socketRef.current?.emit('leave-room', { roomId: roomRef.current });
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    setPeers({}); setMessages([]); setUnread(0); setRoomId(null); roomRef.current = null;
  }, []);

  // --- Media controls ---
  const toggleMic = useCallback(() => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return isMicOn;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
    return track.enabled;
  }, [isMicOn]);

  const toggleVideo = useCallback(() => {
    const track = localRef.current?.getVideoTracks()[0];
    if (!track) return isVideoOn;
    track.enabled = !track.enabled;
    setVideoOn(track.enabled);
    return track.enabled;
  }, [isVideoOn]);

  // Screen share: swap camera track -> display track on every sender; auto-revert on stop
  const toggleScreen = useCallback(async () => {
    if (isSharing) {
      screenTrackRef.current?.stop();
      const cam = camTrackRef.current;
      if (cam) {
        pcsRef.current.forEach((pc) => pc.getSenders().find((s) => s.track?.kind === 'video')?.replaceTrack(cam));
        // swap preview back too
        if (localRef.current) {
          localRef.current.removeTrack(localRef.current.getVideoTracks()[0]);
          localRef.current.addTrack(cam);
          setLocalStream(new MediaStream(localRef.current.getTracks()));
        }
      }
      setSharing(false);
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      screenTrackRef.current = track;
      pcsRef.current.forEach((pc) => pc.getSenders().find((s) => s.track?.kind === 'video')?.replaceTrack(track));
      if (localRef.current) {
        const old = localRef.current.getVideoTracks()[0];
        if (old) localRef.current.removeTrack(old);
        localRef.current.addTrack(track);
        setLocalStream(new MediaStream(localRef.current.getTracks()));
      }
      track.onended = () => toggleScreen(); // user pressed browser "Stop sharing"
      setSharing(true);
    } catch { /* user cancelled share picker */ }
  }, [isSharing]);

  const sendMessage = useCallback((text) => {
    const msg = { id: crypto.randomUUID(), sender: socketRef.current?.id, senderName: identityRef.current.userName, text, time: new Date().toLocaleTimeString() };
    setMessages((m) => [...m, msg]); // optimistic local echo
    socketRef.current?.emit('send-message', { roomId: roomRef.current, message: msg });
  }, []);

  // Stop camera/mic on unmount
  useEffect(() => () => { localRef.current?.getTracks().forEach((t) => t.stop()); socketRef.current?.disconnect(); }, []);

  return (
    <WebRTCContext.Provider value={{ localStream, peers, messages, unread, setUnread, chatOpen, setChatOpen, isMicOn, isVideoOn, isSharing, roomId, joinRoom, leaveRoom, toggleMic, toggleVideo, toggleScreen, sendMessage }}>
      {children}
    </WebRTCContext.Provider>
  );
}
