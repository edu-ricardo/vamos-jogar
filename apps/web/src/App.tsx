// Estilos globais primeiro: os estilos de cada página podem sobrescrevê-los
import './styles/global.scss';
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { JoinGroup } from './pages/JoinGroup';
import { Ludoteca } from './pages/Ludoteca';
import { GroupDetails } from './pages/GroupDetails';
import { EventDetails } from './pages/EventDetails';
import { Grupos } from './pages/Grupos';
import { Conta } from './pages/Conta';
import { Layout } from './components/Layout';
import { Toaster } from 'react-hot-toast';

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
            <Layout>
              <JoinGroup />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ludoteca"
        element={
          <ProtectedRoute>
            <Layout>
              <Ludoteca />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/grupos"
        element={
          <ProtectedRoute>
            <Layout>
              <Grupos />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/conta"
        element={
          <ProtectedRoute>
            <Layout>
              <Conta />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/group/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <GroupDetails />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/event/:groupId/:eventId"
        element={
          <ProtectedRoute>
            <Layout>
              <EventDetails />
            </Layout>
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
        <Toaster
          position="bottom-center"
          // Acima da navegação fixa do rodapé no celular
          containerStyle={{ bottom: 88 }}
          toastOptions={{
            style: {
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
            },
          }}
        />
      </Router>
    </AuthProvider>
  );
}

export default App;
