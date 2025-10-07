import type { PropsWithChildren } from 'react';
import styles from './nav-footer.module.css';

export function NavFooter({ children }: PropsWithChildren) {
  return <div className={styles.footer}>{children}</div>;
}
