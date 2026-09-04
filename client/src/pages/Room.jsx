// Active call page: joins room via WebRTCContext, lays out grid + controls + chat.
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWebRTC } from '../context/WebRTCContext';
import VideoCall from '../components/VideoCall';
import Controls from '../components/Controls';
import ChatSidebar from '../components/ChatSidebar';

export default function Room({ user }) {
  const { roomId } = useParams();
  const nav = useNavigate();
  const { joinRoom, leaveRoom } = useWebRTC();

  // Join once per roomId; leave on unmount (End Call also calls this then navigates)
  useEffect(() => {
    joinRoom(roomId, { userId: user.id, userName: user.name });
    return () => leaveRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const endCall = () => { leaveRoom(); nav('/'); };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-4 py-3">
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">Room: <b className="text-white">{roomId}</b></span>
          <span className="flex items-center gap-2 text-xs text-zinc-400"><span className="h-2 w-2 animate-pulse rounded-full bg-green-500" /> Live</span>
        </header>
        <VideoCall userName={user.name} />
        <Controls onEnd={endCall} />
      </div>
      <ChatSidebar />
    </div>
  );
}
