import { NavLink } from 'react-router';
import {
  IconHome2,
  IconUserCircle,
  IconAddressBook,
  IconSettings,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { AdminGuard } from '../admin-guard';
import styles from './mobile-nav.module.css';

export function MobileNav() {
  const { t } = useTranslation('menu');

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

      {/* Logging out lives on the account page, keeping the bar at four items. */}
      <NavLink
        to="/app/account"
        className={({ isActive }) =>
          `${styles.navItem} ${isActive ? styles.active : ''}`
        }
      >
        <IconUserCircle size={22} stroke={1.5} />
        <span className={styles.label}>{t('account')}</span>
      </NavLink>
    </nav>
  );
}
