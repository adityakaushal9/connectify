// Responsive video grid: local preview + one tile per remote peer.
import { useEffect, useRef } from 'react';
import { MicOff } from 'lucide-react';
import { useWebRTC } from '../context/WebRTCContext';

// Autoplay-safe <video> bound to a MediaStream
function VideoTile({ stream, name, muted, isLocal }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && stream) ref.current.srcObject = stream; }, [stream]);
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-zinc-800 ring-1 ring-white/10">
      <video ref={ref} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
      {/* Name tag + mute indicator */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur">
        {muted && <MicOff size={12} className="text-red-400" />}
        <span>{name}{isLocal ? ' (You)' : ''}</span>
      </div>
    </div>
  );
}

export default function VideoCall({ userName }) {
  const { localStream, peers, isMicOn } = useWebRTC();
  const ids = Object.keys(peers);
  // Grid grows: 1-2 cols on mobile, up to 3-4 on desktop
  const cols = ids.length === 0 ? 'md:grid-cols-1' : ids.length <= 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';

  return (
    <div className={`grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 ${cols}`}>
      {/* Local preview always muted to prevent echo; remote tiles play audio */}
      <VideoTile stream={localStream} name={userName} muted isLocal />
      {ids.map((id) => (
        <VideoTile key={id} stream={peers[id].stream} name={peers[id].userName} muted={false} />
      ))}
      {ids.length === 0 && (
        <p className="col-span-full text-center text-sm text-zinc-500">
          You're the only one here — copy the room link to invite others.
        </p>
      )}
    </div>
  );
}
