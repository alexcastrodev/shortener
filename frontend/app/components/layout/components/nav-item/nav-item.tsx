import { type PropsWithChildren } from 'react';
import { NavLink } from '@mantine/core';
import styles from './nav-item.module.css';

export function NavItem({ children, ...props }: PropsWithChildren<any>) {
  return (
    <li role="presentation" className={styles['nav-item']}>
      {<NavLink {...props}>{children}</NavLink>}
    </li>
  );
}
