import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import './layout.css';

const LINKS = [
  { to: '/', label: 'Agenda', icon: '📅', end: true },
  { to: '/clientes', label: 'Clientes', icon: '👥' },
  { to: '/configuracoes', label: 'Configurações', icon: '⚙️' },
];

export default function Layout() {
  const { settings, logout } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-name">{settings?.professionalName ?? 'Minha Agenda'}</span>
          </div>

          <nav className="nav">
            {LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className="nav-link">
                <span aria-hidden="true">{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <button className="nav-link nav-exit" type="button" onClick={logout}>
          <span aria-hidden="true">🚪</span>
          Sair
        </button>
      </aside>

      <main className="content">
        <Outlet />
      </main>

      {/* No celular a navegacao vai para a base da tela. */}
      <nav className="tabbar">
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className="tab">
            <span aria-hidden="true">{link.icon}</span>
            <span className="tab-label">{link.label}</span>
          </NavLink>
        ))}
        <button className="tab" type="button" onClick={logout}>
          <span aria-hidden="true">🚪</span>
          <span className="tab-label">Sair</span>
        </button>
      </nav>
    </div>
  );
}
