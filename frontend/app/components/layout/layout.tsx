import type { HTMLAttributes, PropsWithChildren } from 'react';
import styles from './layout.module.css';
import { NavList } from './components/nav-list/nav-list';
import { NavItem } from './components/nav-item/nav-item';
import { Nav } from './components/nav/nav';
import { Main } from './components/main/main';
import { Header } from './components/header/header';
import { NavHeader } from './components/nav-header/nav-header';
import { NavFooter } from './components/nav-footer/nav-footer';

export function Layout({
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={styles.layout} {...props}>
      {children}
    </div>
  );
}

Layout.Main = Main;
Layout.Header = Header;
Layout.Nav = Nav;
Layout.NavList = NavList;
Layout.NavItem = NavItem;
Layout.NavHeader = NavHeader;
Layout.NavFooter = NavFooter;
