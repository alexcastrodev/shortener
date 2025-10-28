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
      <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3 text-center">
        <p className="text-sm text-violet-300">
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
          className="w-full px-5 py-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
          disabled={disabled}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <IconMail size={18} className="text-zinc-600" />
        </div>
      </div>
      <p className="text-xs text-zinc-500 mt-1.5 text-center">
        Want to track clicks? Add your email to create a free account later
      </p>
    </div>
  );
}
