import { useEffect, useRef } from 'react';

// A particle globe where clicks travel as arcs from the visitor's city to
// the link: the landing page's 3D centerpiece, drawn on a 2D canvas with a
// small hand-rolled projection (no WebGL or 3D library needed).

type LatLon = [number, number];

const CITIES: Record<string, LatLon> = {
  lisbon: [38.72, -9.14],
  saoPaulo: [-23.55, -46.63],
  newYork: [40.71, -74.0],
  london: [51.5, -0.12],
  berlin: [52.52, 13.4],
  lagos: [6.52, 3.37],
  mumbai: [19.07, 72.87],
  tokyo: [35.68, 139.69],
  sydney: [-33.86, 151.2],
  mexicoCity: [19.43, -99.13],
  capeTown: [-33.92, 18.42],
  singapore: [1.35, 103.82],
};

// Clicks arrive at a link hosted "in Lisbon" (kurz.fyi's home).
const ROUTES: Array<[keyof typeof CITIES, keyof typeof CITIES]> = [
  ['saoPaulo', 'lisbon'],
  ['newYork', 'lisbon'],
  ['tokyo', 'lisbon'],
  ['lagos', 'lisbon'],
  ['mumbai', 'lisbon'],
  ['sydney', 'lisbon'],
  ['mexicoCity', 'lisbon'],
  ['berlin', 'lisbon'],
  ['capeTown', 'lisbon'],
  ['singapore', 'lisbon'],
];

type Vec3 = [number, number, number];

function toVec([lat, lon]: LatLon): Vec3 {
  const phi = (lat * Math.PI) / 180;
  const theta = (lon * Math.PI) / 180;
  return [Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta)];
}

function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return a;
  const s = Math.sin(omega);
  const k1 = Math.sin((1 - t) * omega) / s;
  const k2 = Math.sin(t * omega) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

// Evenly spread points (Fibonacci sphere).
function spherePoints(count: number): Vec3[] {
  const points: Vec3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    points.push([Math.cos(theta) * radius, y, Math.sin(theta) * radius]);
  }
  return points;
}

function cssColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

// Canvas gradients do not understand color-mix(); theme tokens are hex.
function withAlpha(hex: string, alpha: number) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return `rgba(79, 181, 179, ${alpha})`;
  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export function ClickGlobe({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const points = spherePoints(1400);
    const routes = ROUTES.map(([from, to], index) => ({
      from: toVec(CITIES[from]),
      to: toVec(CITIES[to]),
      // Staggered so arcs keep arriving one after another.
      offset: index / ROUTES.length,
    }));

    let rotation = -0.35; // start with the Atlantic facing the viewer
    let tiltTarget = 0.35;
    let tilt = 0.35;
    let dragVelocity = 0;
    let dragging = false;
    let lastX = 0;
    let frame = 0;
    let visible = true;
    let width = 0;
    let height = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const project = (v: Vec3, radius: number): [number, number, number] => {
      // rotate around Y (spin), then X (tilt)
      const cosR = Math.cos(rotation);
      const sinR = Math.sin(rotation);
      const x1 = v[0] * cosR + v[2] * sinR;
      const z1 = -v[0] * sinR + v[2] * cosR;
      const cosT = Math.cos(tilt);
      const sinT = Math.sin(tilt);
      const y2 = v[1] * cosT - z1 * sinT;
      const z2 = v[1] * sinT + z1 * cosT;
      return [width / 2 + x1 * radius, height / 2 - y2 * radius, z2];
    };

    const draw = (time: number) => {
      const primary = cssColor('--app-primary', '#4fb5b3');
      const foreground = cssColor('--app-foreground', '#eef2f5');
      // Room around the sphere for the halo and the lifted arcs (up to
      // 1.28 × radius), so nothing touches the canvas edges.
      const radius = Math.min(width, height) * 0.33;

      context.clearRect(0, 0, width, height);

      // soft halo behind the sphere
      // (ends inside the canvas so its edges never show)
      const edge = Math.min(width, height) / 2;
      const halo = context.createRadialGradient(width / 2, height / 2, radius * 0.5, width / 2, height / 2, edge * 0.98);
      halo.addColorStop(0, withAlpha(primary, 0.2));
      halo.addColorStop(1, withAlpha(primary, 0));
      context.fillStyle = halo;
      context.fillRect(0, 0, width, height);

      // rim light: gives the sphere a readable silhouette
      const rim = context.createRadialGradient(width / 2, height / 2, radius * 0.86, width / 2, height / 2, radius * 1.02);
      rim.addColorStop(0, withAlpha(primary, 0));
      rim.addColorStop(0.85, withAlpha(primary, 0.18));
      rim.addColorStop(1, withAlpha(primary, 0));
      context.fillStyle = rim;
      context.beginPath();
      context.arc(width / 2, height / 2, radius * 1.02, 0, Math.PI * 2);
      context.fill();

      // dots: brighter and larger when facing the viewer
      context.fillStyle = foreground;
      for (const point of points) {
        const [x, y, z] = project(point, radius);
        if (z < -0.15) continue;
        context.globalAlpha = 0.12 + Math.max(0, z) * 0.7;
        const size = 0.9 + Math.max(0, z) * 1.5;
        context.fillRect(x - size / 2, y - size / 2, size, size);
      }
      context.globalAlpha = 1;

      // click arcs: lifted great circles with a travelling head
      const cycle = 4200;
      for (const route of routes) {
        const progress = ((time / cycle + route.offset) % 1) * 1.35;
        const steps = 48;
        let previous: [number, number, number] | null = null;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          if (t > progress) break;
          const onSphere = slerp(route.from, route.to, t);
          const lift = 1 + Math.sin(Math.PI * t) * 0.28;
          const current = project([onSphere[0] * lift, onSphere[1] * lift, onSphere[2] * lift], radius);
          const fade = progress > 1 ? Math.max(0, 1 - (progress - 1) / 0.35) : 1;
          if (previous && current[2] > -0.2 && previous[2] > -0.2) {
            const trail = Math.max(0, 1 - (progress - t) * 2.2);
            context.strokeStyle = primary;
            context.globalAlpha = (0.15 + trail * 0.85) * fade;
            context.lineWidth = 1 + trail * 1.4;
            context.beginPath();
            context.moveTo(previous[0], previous[1]);
            context.lineTo(current[0], current[1]);
            context.stroke();
          }
          previous = current;
        }

        // origin marker
        const [ox, oy, oz] = project(route.from, radius);
        if (oz > 0) {
          context.globalAlpha = 0.9;
          context.fillStyle = primary;
          context.beginPath();
          context.arc(ox, oy, 2.2, 0, Math.PI * 2);
          context.fill();
        }
      }

      // destination: pulsing ring where every click lands
      const [dx, dy, dz] = project(toVec(CITIES.lisbon), radius);
      if (dz > 0) {
        const pulse = (time % 1600) / 1600;
        context.strokeStyle = primary;
        context.globalAlpha = 1 - pulse;
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(dx, dy, 4 + pulse * 18, 0, Math.PI * 2);
        context.stroke();
        context.globalAlpha = 1;
        context.fillStyle = primary;
        context.beginPath();
        context.arc(dx, dy, 3.5, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    let last = performance.now();
    const loop = (now: number) => {
      const delta = Math.min(now - last, 50);
      last = now;
      if (!dragging) {
        rotation += delta * 0.00008 + dragVelocity;
        dragVelocity *= 0.94;
      }
      tilt += (tiltTarget - tilt) * 0.05;
      draw(now);
      if (visible) frame = requestAnimationFrame(loop);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      last = performance.now();
      frame = requestAnimationFrame(loop);
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      tiltTarget = 0.35 + ((event.clientY - rect.top) / rect.height - 0.5) * 0.3;
      if (!dragging) return;
      const deltaX = event.clientX - lastX;
      lastX = event.clientX;
      rotation += deltaX * 0.005;
      dragVelocity = deltaX * 0.0004;
    };
    const onPointerUp = () => {
      dragging = false;
    };

    resize();
    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reduceMotion) draw(1200);
    });
    resizeObserver.observe(canvas);

    if (reduceMotion) {
      draw(1200);
      return () => resizeObserver.disconnect();
    }

    // Only animate while on screen and the tab is visible.
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      if (visible) start();
    });
    intersection.observe(canvas);
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    start();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`touch-pan-y cursor-grab active:cursor-grabbing ${className}`}
    />
  );
}
