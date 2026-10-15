import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../api/system';
import { getAlerts } from '../api/alerts';
import { useTheme } from '../theme/useTheme';

export default function Layout() {
  const [theme, toggleTheme] = useTheme();

  const health = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 15_000,
    retry: false,
  });

  // On ne demande qu'un élément : seul totalElements nous intéresse
  const badge = useQuery({
    queryKey: ['alerts', 'badge'],
    queryFn: () => getAlerts({ acknowledged: false, size: 1 }),
    refetchInterval: 15_000,
    retry: false,
  });

  const online = health.data?.status === 'UP';
  const unacknowledged = badge.data?.totalElements ?? 0;

  return (
    <div className="app">
      <header className="topbar">
        <strong>Irrigation intelligente</strong>

        <nav>
          <NavLink to="/" end>Tableau de bord</NavLink>
          <NavLink to="/mesures">Mesures</NavLink>
          <NavLink to="/irrigation">Irrigation</NavLink>
          <NavLink to="/parametres">Paramètres</NavLink>
          <NavLink to="/alertes">
            Alertes
            {unacknowledged > 0 && (
              <span className="badge">{unacknowledged > 99 ? '99+' : unacknowledged}</span>
            )}
          </NavLink>
        </nav>

        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          aria-label="Changer de thème"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <span className={online ? 'status up' : 'status down'}>
          {online ? 'Backend connecté' : 'Backend injoignable'}
        </span>
      </header>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}