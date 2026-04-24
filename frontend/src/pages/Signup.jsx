import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const AUTH_BACKEND = String(import.meta.env.VITE_AUTH_BACKEND || 'php').toLowerCase();

export default function Signup() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { loginWithResponse } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/signup', {
        method: 'POST',
        // Legacy PHP APIs often use `name`; Node API uses `displayName`.
        body: JSON.stringify({ email, password, displayName, name: displayName })
      });
      await loginWithResponse(
        AUTH_BACKEND === 'php' && data?.success === true ? { user: data.user } : data
      );
      navigate('/chat');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass w-full max-w-md rounded-3xl p-8 shadow-2xl">
        <h2 className="font-display text-3xl mb-2">Create account</h2>
        <p className="text-white/60 mb-6">Start your private AI companion session.</p>
        {error && <div className="mb-4 text-sm text-neon">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-ice"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <input
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-ice"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
          <input
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-ice"
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
          <button
            className="w-full rounded-xl bg-ice py-3 text-black font-semibold hover:opacity-90"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Sign up'}
          </button>
        </form>
        <p className="text-sm text-white/60 mt-6">
          Already have an account?{' '}
          <Link className="text-ice" to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
