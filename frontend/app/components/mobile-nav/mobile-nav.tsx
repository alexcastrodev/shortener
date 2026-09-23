import { NavLink } from 'react-router';
import {
  IconHome2,
  IconUsers,
  IconLogout,
  IconLink,
  IconHistory,
  IconAddressBook,
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
        <NavLink
          to="/admin/shortlinks"
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.active : ''}`
          }
        >
          <IconLink size={22} stroke={1.5} />
          <span className={styles.label}>{t('shortlinks')}</span>
        </NavLink>
        <NavLink
          to="/admin/audit-logs"
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.active : ''}`
          }
        >
          <IconHistory size={22} stroke={1.5} />
          <span className={styles.label}>{t('audit_logs')}</span>
        </NavLink>
      </AdminGuard>

      <button onClick={handleLogout} className={styles.navItem}>
        <IconLogout size={22} stroke={1.5} />
        <span className={styles.label}>{t('logout')}</span>
      </button>
    </nav>
  );
}
