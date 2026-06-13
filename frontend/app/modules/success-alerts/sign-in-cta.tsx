import { useAuth } from '../auth/use-auth';

export function SignInCTA() {
  const { user } = useAuth();

  if (user) {
    return null;
  }

  return (
    <div className="text-center text-sm text-muted-foreground">
      <p>
        Want to track clicks and manage your links?{' '}
        <a
          href="/app"
          className="font-medium text-primary transition-colors hover:underline"
        >
          Sign in
        </a>
      </p>
    </div>
  );
}
