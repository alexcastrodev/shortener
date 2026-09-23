import { useCallback, useRef } from 'react';

// Lets a form submit once until its request settles. A mutation's isPending
// only flips on the next render, so two submits in the same tick (a password
// manager resubmitting, a double Enter) would both go through.
export function useSubmitLock() {
  const locked = useRef(false);

  return useCallback((run: (release: () => void) => void) => {
    if (locked.current) return;
    locked.current = true;
    run(() => {
      locked.current = false;
    });
  }, []);
}
