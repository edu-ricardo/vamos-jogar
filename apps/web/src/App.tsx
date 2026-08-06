import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { JoinGroup } from './pages/JoinGroup';
import { Ludoteca } from './pages/Ludoteca';
import { GroupDetails } from './pages/GroupDetails';
import { EventDetails } from './pages/EventDetails';
import { Toaster } from 'react-hot-toast';
import './styles/global.scss';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } 
      />
      <Route 
        path="/join/:token" 
        element={
          <ProtectedRoute>
            <JoinGroup />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/ludoteca" 
        element={
          <ProtectedRoute>
            <Ludoteca />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/group/:id" 
        element={
          <ProtectedRoute>
            <GroupDetails />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/event/:groupId/:eventId" 
        element={
          <ProtectedRoute>
            <EventDetails />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
        <Toaster position="bottom-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
      </Router>
    </AuthProvider>
  );
}

export default App;
