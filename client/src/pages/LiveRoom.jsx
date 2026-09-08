// SFU room (LiveKit) — server relays media, so no P2P/NAT pain and no 6-peer cap.
// Flow: POST /api/livekit/token -> room.connect(url, token) -> publish camera/mic ->
// remote tracks arrive via TrackSubscribed -> attach to <video>. Chat = data packets.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Room, RoomEvent, Track } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff, MonitorUp, MessageSquare, PhoneOff, X, Send } from 'lucide-react';

const API = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
const enc = new TextEncoder();
const dec = new TextDecoder();

// One tile per participant: attaches their camera (or screen share) + audio tracks
function Tile({ participant, isLocal }) {
  const vRef = useRef(null);
  const aRef = useRef(null);
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Prefer screen-share video if they are sharing, else camera
  const pickVideo = () => {
    const pubs = [...participant.videoTrackPublications.values()];
    return (
      pubs.find((p) => p.source === Track.Source.ScreenShare && p.track) ||
      pubs.find((p) => p.source === Track.Source.Camera && p.track && !p.isMuted) ||
      null
    );
  };

  // Attach on mount (tracks already published) AND on late subscribe.
  // Mount-only attach misses tracks published after the tile exists — exactly the
  // "joiner sees me, I don't see joiner" asymmetry.
  useEffect(() => {
    const pub = pickVideo();
    if (pub && vRef.current) pub.track.attach(vRef.current);
    participant.audioTrackPublications.forEach((p) => p.track && aRef.current && p.track.attach(aRef.current));
    const onSub = (track) => {
      if (track.kind === Track.Kind.Video && vRef.current) track.attach(vRef.current);
      if (track.kind === Track.Kind.Audio && aRef.current) track.attach(aRef.current);
      refresh();
    };
    const onUnsub = (track) => { track.detach(); refresh(); };
    participant.on('trackSubscribed', onSub);
    participant.on('trackUnsubscribed', onUnsub);
    participant.on('trackMuted', refresh);
    participant.on('trackUnmuted', refresh);
    return () => {
      participant.off('trackSubscribed', onSub);
      participant.off('trackUnsubscribed', onUnsub);
      participant.off('trackMuted', refresh);
      participant.off('trackUnmuted', refresh);
      participant.trackPublications.forEach((p) => p.track?.detach());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant]);

  const videoPub = pickVideo();
  const camMuted = !participant.videoTrackPublications.get('camera') || participant.isCameraEnabled === false;
  const micMuted = !participant.isMicrophoneEnabled;

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-zinc-800 ring-1 ring-white/10">
      <video ref={vRef} autoPlay playsInline muted={isLocal} className="h-full w-full object-cover" style={{ display: videoPub ? 'block' : 'none' }} />
      {!videoPub && (
        <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-zinc-600">
          {(participant.name || 'G')[0].toUpperCase()}
        </div>
      )}
      <audio ref={aRef} autoPlay />
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur">
        {micMuted && !isLocal && <MicOff size={12} className="text-red-400" />}
        <span>{participant.name || 'Guest'}{isLocal ? ' (You)' : ''}</span>
      </div>
      {camMuted && videoPub && <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-zinc-300">sharing screen</span>}
    </div>
  );
}

export default function LiveRoom({ user }) {
  const { roomId } = useParams();
  const nav = useNavigate();
  const [room, setRoom] = useState(null);
  const [err, setErr] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const bottomRef = useRef(null);

  // Connect once per roomId: token -> join -> publish camera+mic
  useEffect(() => {
    let r;
    (async () => {
      try {
        const res = await fetch(`${API}/api/livekit/token`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include', body: JSON.stringify({ roomName: roomId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Token failed');
        r = new Room({ adaptiveStream: true, dynacast: true });
        r.on(RoomEvent.ParticipantConnected, refresh);
        r.on(RoomEvent.ParticipantDisconnected, refresh);
        r.on(RoomEvent.TrackSubscribed, refresh);
        r.on(RoomEvent.TrackUnsubscribed, refresh);
        r.on(RoomEvent.TrackMuted, refresh);
        r.on(RoomEvent.TrackUnmuted, refresh);
        r.on(RoomEvent.LocalTrackPublished, refresh);
        r.on(RoomEvent.DataReceived, (payload, p) => {
          try {
            const { text } = JSON.parse(dec.decode(payload));
            setMessages((m) => [...m, { id: crypto.randomUUID(), name: p?.name || 'Guest', text, time: new Date().toLocaleTimeString() }]);
          } catch { /* non-chat data */ }
        });
        await r.connect(data.url, data.token);
        try {
          await r.localParticipant.setCameraEnabled(true); // prompts for camera
        } catch {
          await r.localParticipant.setCameraEnabled(false); // denied -> audio-only, same as mesh path
        }
        await r.localParticipant.setMicrophoneEnabled(true);
        setRoom(r);
      } catch (e) {
        setErr(e.message);
      }
    })();
    return () => { r?.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, chatOpen]);

  if (err) return <div className="flex h-screen items-center justify-center p-6 text-center text-sm text-red-400">{err}<br />Check LIVEKIT_* env on server.</div>;
  if (!room) return <div className="flex h-screen items-center justify-center text-sm text-zinc-400">Joining SFU room…</div>;

  const parts = [room.localParticipant, ...room.remoteParticipants.values()];
  const cols = parts.length <= 1 ? 'md:grid-cols-1' : parts.length <= 4 ? 'md:grid-cols-2' : 'md:grid-cols-3';
  const lp = room.localParticipant;

  const send = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    lp.publishData(enc.encode(JSON.stringify({ text: draft.trim() })), { reliable: true });
    setMessages((m) => [...m, { id: crypto.randomUUID(), name: `${user.name} (You)`, text: draft.trim(), time: new Date().toLocaleTimeString() }]);
    setDraft('');
  };

  const Btn = ({ onClick, active, danger, label, children }) => (
    <button onClick={onClick} title={label} aria-label={label}
      className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition ${danger ? 'bg-red-500 text-white hover:bg-red-600' : active ? 'bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'}`}>
      {children}
    </button>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-4 py-3">
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">SFU Room: <b className="text-white">{roomId}</b></span>
          <span className="flex items-center gap-2 text-xs text-zinc-400"><span className="h-2 w-2 animate-pulse rounded-full bg-green-500" /> Live · {parts.length} in call</span>
        </header>
        <div className={`grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 ${cols}`}>
          {parts.map((p) => <Tile key={p.sid} participant={p} isLocal={p === lp} />)}
        </div>
        <div className="pointer-events-none absolute bottom-6 left-0 right-0 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3 shadow-2xl backdrop-blur-xl">
            <Btn onClick={async () => { await lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled); refresh(); }} active={lp.isMicrophoneEnabled} label="Mic">
              {lp.isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </Btn>
            <Btn onClick={async () => { await lp.setCameraEnabled(!lp.isCameraEnabled); refresh(); }} active={lp.isCameraEnabled} label="Camera">
              {lp.isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            </Btn>
            <Btn onClick={async () => { await lp.setScreenShareEnabled(!lp.isScreenShareEnabled); refresh(); }} active={lp.isScreenShareEnabled} label="Share screen">
              <MonitorUp size={20} />
            </Btn>
            <Btn onClick={() => setChatOpen(!chatOpen)} active={chatOpen} label="Chat"><MessageSquare size={20} /></Btn>
            <div className="mx-1 h-8 w-px bg-white/10" />
            <Btn onClick={() => { room.disconnect(); nav('/'); }} danger label="End call"><PhoneOff size={20} /></Btn>
          </div>
        </div>
      </div>
      {chatOpen && (
        <aside className="flex h-full w-80 shrink-0 flex-col border-l border-white/10 bg-zinc-900">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <h3 className="font-semibold text-white">Chat</h3>
            <button onClick={() => setChatOpen(false)} className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close chat"><X size={18} /></button>
          </div>
          <div className="chat-scroll flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && <p className="text-center text-sm text-zinc-500">No messages yet — say hi 👋</p>}
            {messages.map((m) => (
              <div key={m.id} className="rounded-xl bg-zinc-800 p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-indigo-300">{m.name}</span>
                  <span className="text-[10px] text-zinc-500">{m.time}</span>
                </div>
                <p className="mt-0.5 break-words text-sm text-zinc-100">{m.text}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-white/10 p-3">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message..."
              className="min-w-0 flex-1 rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-indigo-500" />
            <button className="rounded-xl bg-indigo-500 p-2.5 text-white hover:bg-indigo-600" aria-label="Send"><Send size={16} /></button>
          </form>
        </aside>
      )}
    </div>
  );
}
