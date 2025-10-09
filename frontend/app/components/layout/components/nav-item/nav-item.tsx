import { type PropsWithChildren } from 'react';
import { NavLink } from '@mantine/core';
import styles from './nav-item.module.css';
import { useLocation } from 'react-router';

export function NavItem({ children, ...props }: PropsWithChildren<any>) {
  const router = useLocation();
  const isActive = router.pathname === props.to;

  return (
    <li role="presentation" className={styles['nav-item']}>
      {
        <NavLink
          {...props}
          color={isActive ? 'blue' : 'gray'}
          variant={isActive ? 'light' : 'subtle'}
        >
          {children}
        </NavLink>
      }
    </li>
  );
}
