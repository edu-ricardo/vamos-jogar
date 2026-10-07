import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.scss';

const NAV_ITEMS = [
  { to: '/', label: 'Início', icon: '🏠' },
  { to: '/ludoteca', label: 'Ludoteca', icon: '🎲' },
  { to: '/grupos', label: 'Grupos', icon: '👥' },
  { to: '/conta', label: 'Conta', icon: '👤' },
];

// Celular: barra no topo e navegação no rodapé. Desktop: barra lateral fixa.
export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { logout, isAppAdmin } = useAuth();
  const navItems = isAppAdmin
    ? [...NAV_ITEMS, { to: '/admin', label: 'Admin', icon: '🛡️' }]
    : NAV_ITEMS;

  return (
    <div className="app-shell">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <aside className="app-sidebar">
        <Link to="/" className="app-brand">
          <span className="app-logo">VJ</span>
          <span className="app-brand-name">Vamos Jogar</span>
        </Link>

        <nav className="app-nav" aria-label="Principal">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className="app-nav-link">
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button type="button" onClick={logout} className="app-logout">
          Sair
        </button>
      </aside>

      <main id="conteudo" tabIndex={-1} className="app-main">
        {children}
      </main>
    </div>
  );
};
