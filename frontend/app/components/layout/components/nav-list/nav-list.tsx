import type { PropsWithChildren, HTMLAttributes } from 'react';
import styles from './nav-list.module.css';

export function NavList({
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLUListElement>>) {
  return (
    <ul role="menu" className={styles['nav-list']} {...props}>
      {children}
    </ul>
  );
}
