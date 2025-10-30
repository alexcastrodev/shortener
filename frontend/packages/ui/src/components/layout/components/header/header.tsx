import type { HTMLAttributes, PropsWithChildren } from 'react';
import styles from './header.module.css';

export function Header({
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLHeadElement>>) {
  return (
    <header className={styles.header} {...props}>
      {children}
    </header>
  );
}
