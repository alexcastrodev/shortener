import type { PropsWithChildren } from 'react';
import styles from './nav.module.css';

export function Nav({ children }: PropsWithChildren) {
  return (
    <nav role="navigation" className={styles.nav}>
      {children}
    </nav>
  );
}
