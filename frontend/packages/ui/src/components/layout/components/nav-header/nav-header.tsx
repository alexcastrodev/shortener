import type { PropsWithChildren, HTMLAttributes } from 'react';
import styles from './nav-header.module.css';

export function NavHeader({
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={styles.header} {...props}>
      {children}
    </div>
  );
}
