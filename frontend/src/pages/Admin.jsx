import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import Navbar from '../components/Navbar.jsx';

export default function Admin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
    if (!loading && user && !user.isAdmin) {
      navigate('/chat');
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (user?.isAdmin) {
      apiFetch('/api/admin/stats')
        .then((data) => setStats(data))
        .catch((err) => setError(err.message));
    }
  }, [user]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="px-6 pb-10">
        <div className="glass rounded-3xl p-8 max-w-3xl">
          <h2 className="font-display text-3xl">Admin dashboard</h2>
          <p className="text-white/60 mt-2">Quick health snapshot for the platform.</p>
          {error && <div className="mt-4 text-sm text-neon">{error}</div>}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <p className="text-xs text-white/50">Total users</p>
                <p className="text-3xl font-display mt-2">{stats.users}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <p className="text-xs text-white/50">Total messages</p>
                <p className="text-3xl font-display mt-2">{stats.messages}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
