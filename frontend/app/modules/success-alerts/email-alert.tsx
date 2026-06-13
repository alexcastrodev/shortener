import { IconMail, IconExternalLink } from '@tabler/icons-react';

interface EmailAlertProps {
  email: string;
}

export function EmailAlert({ email }: EmailAlertProps) {
  return (
    <div className="rounded-lg border border-primary/25 bg-primary/10 p-4">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <IconMail size={20} className="text-primary" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Access Your Dashboard
          </h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Create an account with <strong>{email}</strong> to access your
            dashboard and track this link's metrics.
          </p>
          <a
            href="/app"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to Dashboard
            <IconExternalLink size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
