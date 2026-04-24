import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import Chat from './pages/Chat.jsx';
import Admin from './pages/Admin.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/70">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? '/chat' : '/login'} replace />} />
      <Route path="/chat" element={user ? <Chat /> : <Navigate to="/login" replace />} />
      <Route path="/admin" element={user ? <Admin /> : <Navigate to="/login" replace />} />
      <Route path="/login" element={user ? <Navigate to="/chat" replace /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/chat" replace /> : <Signup />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
