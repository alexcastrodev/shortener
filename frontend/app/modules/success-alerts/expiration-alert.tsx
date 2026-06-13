import { IconAlertTriangle } from '@tabler/icons-react';
import { useAuth } from '../auth/use-auth';

export function ExpirationAlert() {
  const { user } = useAuth();

  if (user) {
    return null;
  }

  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <IconAlertTriangle
            size={20}
            className="text-yellow-800 dark:text-yellow-100"
          />
        </div>
        <div className="flex-1">
          <h3 className="mb-1 text-sm font-semibold text-foreground">
            Link Expiration Policy
          </h3>
          <p className="text-sm text-muted-foreground">
            Links will be automatically deleted after 30 days without access
          </p>

          <p className="mt-3 text-sm text-muted-foreground">
            Links are checked by Google Safe Browsing. If a link does not work,
            it may have been blocked by the safety service.
          </p>
        </div>
      </div>
    </div>
  );
}
