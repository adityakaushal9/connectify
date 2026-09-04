// Router + auth guard. Session = httpOnly cookie; localStorage keeps profile only.
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WebRTCProvider } from './context/WebRTCContext';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Room from './pages/Room';

const API = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
const savedUser = () => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } };

export default function App() {
  const [user, setUser] = useState(savedUser());

  // Re-validate cookie session on reload (cookie may have expired even if profile cached)
  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.user) { setUser(d.user); localStorage.setItem('user', JSON.stringify(d.user)); } else if (localStorage.getItem('user')) { localStorage.removeItem('user'); setUser(null); } })
      .catch(() => {});
  }, []);

  const logout = async () => {
    try { await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' }); } catch { /* offline logout */ }
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <WebRTCProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Auth onAuth={setUser} />} />
            <Route path="/" element={user ? <Dashboard user={user} onLogout={logout} /> : <Navigate to="/login" />} />
            <Route path="/room/:roomId" element={user ? <Room user={user} /> : <Navigate to="/login" />} />
          </Routes>
        </BrowserRouter>
      </WebRTCProvider>
    </div>
  );
}
