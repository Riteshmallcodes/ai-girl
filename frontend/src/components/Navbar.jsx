import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between px-6 py-4">
      <div>
        <h1 className="font-display text-2xl gradient-text">AI Virtual Girl Assistant</h1>
        <p className="text-xs text-white/50">Always here. Always listening.</p>
      </div>
      <div className="flex items-center gap-4 text-sm">
        {user?.isAdmin && (
          <Link className="text-ice hover:text-white" to="/admin">Admin</Link>
        )}
        {user && (
          <button
            className="rounded-full border border-white/10 px-4 py-2 text-white/70 hover:text-white"
            onClick={logout}
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
