import { NavLink } from 'react-router';
import { IconHome2, IconUsers, IconLogout } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useUserState } from '@internal/core/states/use-user-state';
import { AdminGuard } from '../admin-guard';
import styles from './mobile-nav.module.css';

export function MobileNav() {
  const { t } = useTranslation('menu');
  const navigate = useNavigate();
  const { clear } = useUserState();

  const handleLogout = () => {
    clear();
    navigate('/login');
  };

  return (
    <nav className={styles.mobileNav}>
      <NavLink
        to="/app"
        className={({ isActive }) =>
          `${styles.navItem} ${isActive ? styles.active : ''}`
        }
        end
      >
        <IconHome2 size={22} stroke={1.5} />
        <span className={styles.label}>{t('dashboard')}</span>
      </NavLink>

      <AdminGuard>
        <NavLink
          to="/admin/users"
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.active : ''}`
          }
        >
          <IconUsers size={22} stroke={1.5} />
          <span className={styles.label}>{t('users')}</span>
        </NavLink>
      </AdminGuard>

      <button onClick={handleLogout} className={styles.navItem}>
        <IconLogout size={22} stroke={1.5} />
        <span className={styles.label}>{t('logout')}</span>
      </button>
    </nav>
  );
}
