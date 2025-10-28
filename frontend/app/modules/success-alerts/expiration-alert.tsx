import { IconAlertTriangle } from '@tabler/icons-react';
import { useAuth } from '../auth/use-auth';

export function ExpirationAlert() {
  const { user } = useAuth();

  if (user) {
    return null;
  }

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 backdrop-blur-sm">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <IconAlertTriangle size={20} className="text-yellow-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-yellow-400 mb-1">
            Link Expiration Policy
          </h3>
          <p className="text-sm text-yellow-200/80">
            Links will be automatically deleted after 30 days without access
          </p>

          <p className="text-sm text-yellow-200/80 mt-3">
            All links are checked by Google Safe Browsing, if your link does not
            work, MAYBE was blocked by Safety Service.
          </p>
        </div>
      </div>
    </div>
  );
}
