import { NavLink } from 'react-router';
import {
  IconHome2,
  IconLogout,
  IconAddressBook,
  IconSettings,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useLogout } from '../../modules/auth/use-logout';
import { AdminGuard } from '../admin-guard';
import styles from './mobile-nav.module.css';

export function MobileNav() {
  const { t } = useTranslation('menu');
  const handleLogout = useLogout();

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

      <NavLink
        to="/app/pages"
        className={({ isActive }) =>
          `${styles.navItem} ${isActive ? styles.active : ''}`
        }
      >
        <IconAddressBook size={22} stroke={1.5} />
        <span className={styles.label}>{t('pages')}</span>
      </NavLink>

      {/* One entry for every admin section; /admin lists them. */}
      <AdminGuard>
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.active : ''}`
          }
        >
          <IconSettings size={22} stroke={1.5} />
          <span className={styles.label}>{t('admin')}</span>
        </NavLink>
      </AdminGuard>

      <button onClick={handleLogout} className={styles.navItem}>
        <IconLogout size={22} stroke={1.5} />
        <span className={styles.label}>{t('logout')}</span>
      </button>
    </nav>
  );
}
