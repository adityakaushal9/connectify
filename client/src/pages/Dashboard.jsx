// Dashboard: start instant call or join by Room ID, copy invite link.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, LogIn, Copy, Check, LogOut } from 'lucide-react';

const rid = () => Math.random().toString(36).slice(2, 8); // short shareable id

export default function Dashboard({ user, onLogout }) {
  const [joinId, setJoinId] = useState('');
  const [copied, setCopied] = useState(false);
  const nav = useNavigate();
  const lastRoom = joinId.trim() || rid();

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/room/${lastRoom}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Welcome, {user?.name} 👋</h1>
        <p className="mt-1 text-sm text-zinc-400">Start an instant meeting or join with a Room ID</p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2">
        {/* Instant call card */}
        <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6">
          <Video className="text-indigo-400" size={28} />
          <h2 className="mt-3 font-semibold text-white">New meeting</h2>
          <p className="mb-4 text-sm text-zinc-400">Room: <code className="text-indigo-300">{lastRoom}</code></p>
          <div className="flex gap-2">
            <button onClick={() => nav(`/room/${lastRoom}`)} className="flex-1 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600">
              Start now
            </button>
            <button onClick={copyLink} className="rounded-xl bg-zinc-800 px-3 text-zinc-300 hover:bg-zinc-700" title="Copy room link">
              {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
            </button>
          </div>
        </div>

        {/* Join card */}
        <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6">
          <LogIn className="text-emerald-400" size={28} />
          <h2 className="mt-3 font-semibold text-white">Join meeting</h2>
          <p className="mb-4 text-sm text-zinc-400">Paste a Room ID from an invite</p>
          <div className="flex gap-2">
            <input value={joinId} onChange={(e) => setJoinId(e.target.value)} placeholder="e.g. abc123"
              className="min-w-0 flex-1 rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-emerald-500" />
            <button onClick={() => joinId.trim() && nav(`/room/${joinId.trim()}`)} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600">
              Join
            </button>
          </div>
        </div>
      </div>

      <button onClick={onLogout} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white">
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );
}
