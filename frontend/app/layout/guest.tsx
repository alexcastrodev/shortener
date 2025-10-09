import { Outlet } from 'react-router';
import { Providers } from './providers';

export default function LayoutComponent() {
  return (
    <Providers>
      <Outlet />
    </Providers>
  );
}
