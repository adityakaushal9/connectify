// Slide-over chat drawer: real-time messages over the same Socket.IO connection.
import { useEffect, useRef, useState } from 'react';
import { X, Send } from 'lucide-react';
import { useWebRTC } from '../context/WebRTCContext';

export default function ChatSidebar() {
  const { messages, sendMessage, chatOpen, setChatOpen } = useWebRTC();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef(null);

  // Auto-scroll to newest message
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, chatOpen]);

  const submit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendMessage(draft.trim());
    setDraft('');
  };

  return (
    <aside className={`flex h-full w-80 shrink-0 flex-col border-l border-white/10 bg-zinc-900 transition-all duration-300 ${chatOpen ? 'translate-x-0' : 'hidden'}`}>
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <h3 className="font-semibold text-white">Chat</h3>
        <button onClick={() => setChatOpen(false)} className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close chat">
          <X size={18} />
        </button>
      </div>
      <div className="chat-scroll flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-center text-sm text-zinc-500">No messages yet — say hi 👋</p>}
        {messages.map((m) => (
          <div key={m.id} className="rounded-xl bg-zinc-800 p-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-indigo-300">{m.senderName}</span>
              <span className="text-[10px] text-zinc-500">{m.time}</span>
            </div>
            <p className="mt-0.5 break-words text-sm text-zinc-100">{m.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message..."
          className="min-w-0 flex-1 rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-indigo-500" />
        <button className="rounded-xl bg-indigo-500 p-2.5 text-white hover:bg-indigo-600" aria-label="Send">
          <Send size={16} />
        </button>
      </form>
    </aside>
  );
}
