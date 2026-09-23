import { useCallback, useRef, type PointerEvent } from 'react';

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// Follows the pointer over an element and exposes its position as CSS
// variables: --spot-x/--spot-y (px, for spotlight gradients) and
// --tilt-x/--tilt-y (deg, for 3D rotation). Leaving resets the tilt to
// the resting angle given by the stylesheet.
export function usePointerTilt<T extends HTMLElement>(maxTilt = 8) {
  const ref = useRef<T>(null);

  const onPointerMove = useCallback(
    (event: PointerEvent<T>) => {
      const element = ref.current;
      if (!element || event.pointerType === 'touch') return;

      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      element.style.setProperty('--spot-x', `${x}px`);
      element.style.setProperty('--spot-y', `${y}px`);

      if (prefersReducedMotion()) return;
      const rotateY = (x / rect.width - 0.5) * 2 * maxTilt;
      const rotateX = (0.5 - y / rect.height) * 2 * maxTilt;
      element.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);
      element.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);
    },
    [maxTilt]
  );

  const onPointerLeave = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element.style.removeProperty('--tilt-x');
    element.style.removeProperty('--tilt-y');
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
