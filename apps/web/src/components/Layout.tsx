import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#09090b', color: '#fff' }}>
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '15px 20px', 
        borderBottom: '1px solid #27272a',
        background: '#18181b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{ width: '32px', height: '32px', background: '#7e22ce', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
            VJ
          </div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'none', '@media (min-width: 600px)': { display: 'block' } } as any}>Vamos Jogar</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {location.pathname !== '/' && (
            <button 
              onClick={() => navigate('/')} 
              style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #71717a', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Home
            </button>
          )}
          <button 
            onClick={() => navigate('/conta')} 
            style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #3b82f6', borderRadius: '6px', color: '#3b82f6', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Conta
          </button>
          <button 
            onClick={logout} 
            style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #ef4444', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Sair
          </button>
        </div>
      </header>
      
      <main style={{ flex: 1, padding: '20px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        {children}
      </main>
    </div>
  );
};
