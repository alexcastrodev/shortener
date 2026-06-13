import { IconMail } from '@tabler/icons-react';
import { useAuth } from '../auth/use-auth';

interface EmailFieldProps {
  email: string;
  onChange: (email: string) => void;
  disabled?: boolean;
}

export function EmailField({ email, onChange, disabled }: EmailFieldProps) {
  const { user } = useAuth();

  if (user) {
    return (
      <div className="rounded-md border border-primary/20 bg-primary/10 p-3 text-center">
        <p className="text-sm text-primary">
          Your link will be accessible in your dashboard after creation
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <input
          type="email"
          value={email}
          onChange={e => onChange(e.target.value)}
          placeholder="your@email.com (optional - for analytics)"
          className="min-h-11 w-full rounded-md border border-border bg-card px-4 pr-10 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          disabled={disabled}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <IconMail size={18} className="text-muted-foreground" />
        </div>
      </div>
      <p className="mt-1.5 text-center text-xs text-muted-foreground">
        Want to track clicks? Add your email to create an account later
      </p>
    </div>
  );
}
