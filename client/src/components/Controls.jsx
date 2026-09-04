// Floating frosted-glass control bar (Zoom controls + Discord dark style).
import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff, MessageSquare, PhoneOff } from 'lucide-react';
import { useWebRTC } from '../context/WebRTCContext';

function Btn({ onClick, active, danger, label, children }) {
  return (
    <button
      onClick={onClick} title={label} aria-label={label}
      className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition
        ${danger ? 'bg-red-500 text-white hover:bg-red-600'
          : active ? 'bg-zinc-700 text-white hover:bg-zinc-600'
          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'}`}
    >
      {children}
    </button>
  );
}

export default function Controls({ onEnd }) {
  const { isMicOn, isVideoOn, isSharing, chatOpen, setChatOpen, unread, setUnread, toggleMic, toggleVideo, toggleScreen } = useWebRTC();
  return (
    <div className="pointer-events-none absolute bottom-6 left-0 right-0 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3 shadow-2xl backdrop-blur-xl">
        <Btn onClick={toggleMic} active={isMicOn} label={isMicOn ? 'Mute' : 'Unmute'}>
          {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
        </Btn>
        <Btn onClick={toggleVideo} active={isVideoOn} label={isVideoOn ? 'Stop video' : 'Start video'}>
          {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
        </Btn>
        <Btn onClick={toggleScreen} active={isSharing} label={isSharing ? 'Stop sharing' : 'Share screen'}>
          {isSharing ? <MonitorOff size={20} /> : <MonitorUp size={20} />}
        </Btn>
        <Btn onClick={() => { setChatOpen(!chatOpen); if (!chatOpen) setUnread(0); }} active={chatOpen} label="Chat">
          <span className="relative">
            <MessageSquare size={20} />
            {unread > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] text-white">{unread}</span>}
          </span>
        </Btn>
        <div className="mx-1 h-8 w-px bg-white/10" />
        <Btn onClick={onEnd} danger label="End call"><PhoneOff size={20} /></Btn>
      </div>
    </div>
  );
}
