import { IconMail, IconExternalLink } from '@tabler/icons-react';

interface EmailAlertProps {
  email: string;
}

export function EmailAlert({ email }: EmailAlertProps) {
  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 backdrop-blur-sm">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <IconMail size={20} className="text-blue-400" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="text-sm font-semibold text-blue-400 mb-2">
            Access Your Dashboard
          </h3>
          <p className="text-sm text-blue-200/90 mb-3">
            Create an account with <strong>{email}</strong> to access your
            dashboard and track this link's metrics.
          </p>
          <a
            href="/app"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-sm transition-all"
          >
            Go to Dashboard
            <IconExternalLink size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
