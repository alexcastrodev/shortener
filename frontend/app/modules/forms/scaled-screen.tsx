import { useLayoutEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';

export function ScaledScreen({
  width,
  height,
  children,
}: PropsWithChildren<{ width: number; height: number }>) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const element = outer.current;
    if (!element) return;
    const fit = () => setScale(Math.min(1, element.clientWidth / width));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={outer} className="overflow-hidden" style={{ height: height * scale }}>
      <div
        data-testid="preview-screen"
        className="origin-top-left overflow-x-hidden overflow-y-auto"
        style={{ width, height, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
