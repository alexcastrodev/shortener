const KEY = 'kurz:oauth-return';
const PATH = /^\/oauth\/authorize\?[\x21-\x7e]*$/;

export function rememberAuthorization(search: string) {
  const path = `/oauth/authorize${search}`;
  try {
    if (PATH.test(path) && path.length <= 4096) sessionStorage.setItem(KEY, path);
  } catch {
    return;
  }
}

export function takeAuthorization(): string | null {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return path && PATH.test(path) ? path : null;
  } catch {
    return null;
  }
}

export function goAfterLogin(navigate: (to: string) => void) {
  const pending = takeAuthorization();
  if (pending) window.location.assign(pending);
  else navigate('/app');
}
