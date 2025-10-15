import type { PropsWithChildren, ReactNode } from 'react';
import { useGetLoggedUser } from '@internal/core/actions/get-logged-user/get-logged-user.hook';

interface AdminGuardProps {
  fallback?: ReactNode;
}

export function AdminGuard({
  children,
  fallback = null,
}: PropsWithChildren<AdminGuardProps>) {
  const { data } = useGetLoggedUser();

  if (!data?.user?.admin) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
