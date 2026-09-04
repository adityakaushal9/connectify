// Login / Register — JWT lives in httpOnly cookie (set by server), JS keeps only profile.
import { useState } from 'react';
import { Video } from 'lucide-react';

const API = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const res = await fetch(`${API}/api/auth/${mode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // required: lets browser store + send the httpOnly cookie
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Auth failed');
      localStorage.setItem('user', JSON.stringify(data.user)); // profile only, no token
      onAuth(data.user);
    } catch (e2) { setErr(e2.message); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-8">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500"><Video size={20} className="text-white" /></span>
          <h1 className="text-xl font-bold text-white">Connectify</h1>
        </div>
        {mode === 'register' && (
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mb-3 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500" />
        )}
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="mb-3 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500" />
        <input required type="password" placeholder="Password (min 6)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="mb-4 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500" />
        {err && <p className="mb-3 text-sm text-red-400">{err}</p>}
        <button className="w-full rounded-xl bg-indigo-500 py-2 text-sm font-medium text-white hover:bg-indigo-600">
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="mt-3 w-full text-center text-sm text-zinc-400 hover:text-white">
          {mode === 'login' ? 'No account? Register' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
