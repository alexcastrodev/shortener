import { Outlet } from 'react-router';

// Public bio pages belong to the user, not to the Kurz site: no product
// header or footer. Each page paints its own theme (see BioPageView).
export default function BioLayout() {
  return <Outlet />;
}
