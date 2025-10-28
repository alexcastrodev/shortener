import { useAuth } from '../auth/use-auth';

export function SignInCTA() {
  const { user } = useAuth();

  if (user) {
    return null;
  }

  return (
    <div className="text-sm text-zinc-500">
      <p>
        Want to track clicks and manage your links?{' '}
        <a
          href="/app"
          className="text-violet-400 hover:text-violet-300 transition-colors"
        >
          Sign in for free
        </a>
      </p>
    </div>
  );
}
