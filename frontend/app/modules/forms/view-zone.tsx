import {
  createContext,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { BioTheme } from '../bio-page/themes';
import { timeZoneOptions } from '../../i18n/time-zones.ts';
import {
  browserZone,
  convertWall,
  readZone,
  saveZone,
  zoneChoices,
  type Wall,
} from './zone-time.ts';

type ViewZone = {
  zone: string | undefined;
  formZone: string | undefined;
  shifted: boolean;
  setZone: (zone: string) => void;
  toView: (wall: Wall) => Wall;
};

const NONE: ViewZone = {
  zone: undefined,
  formZone: undefined,
  shifted: false,
  setZone: () => {},
  toView: wall => wall,
};

const ViewZoneContext = createContext<ViewZone>(NONE);

export const useViewZone = () => useContext(ViewZoneContext);

export function ViewZoneProvider({
  formZone,
  children,
}: {
  formZone: string | undefined;
  children: ReactNode;
}) {
  const [chosen, setChosen] = useState<string | undefined>(() =>
    typeof window === 'undefined' ? undefined : readZone(window.localStorage)
  );
  const zone = formZone ? (chosen ?? formZone) : undefined;
  const value = useMemo<ViewZone>(
    () => ({
      zone,
      formZone,
      shifted: Boolean(zone && formZone && zone !== formZone),
      setZone: next => {
        setChosen(next);
        saveZone(window.localStorage, next);
      },
      toView: wall => convertWall(wall, formZone, zone),
    }),
    [zone, formZone]
  );
  return (
    <ViewZoneContext.Provider value={value}>{children}</ViewZoneContext.Provider>
  );
}

export function ZoneSelect({ theme }: { theme: BioTheme }) {
  const { t } = useTranslation('respond');
  const { zone, formZone, setZone } = useViewZone();
  const id = useId();
  const choices = useMemo(
    () =>
      zone && formZone
        ? zoneChoices(formZone, browserZone(), timeZoneOptions(zone))
        : [],
    [zone, formZone]
  );
  if (!zone || !formZone) return null;

  return (
    <div className="flex min-w-0 items-center gap-2 text-xs">
      <label htmlFor={id} className="shrink-0 opacity-70">
        {t('booking_zone_label')}
      </label>
      <select
        id={id}
        value={zone}
        onChange={event => setZone(event.target.value)}
        className={`min-h-9 min-w-0 max-w-full rounded-lg px-2 py-1 text-xs ${theme.button}`}
      >
        {choices.map(choice => (
          <option key={choice.value} value={choice.value}>
            {choice.mine
              ? t('booking_zone_mine', { zone: choice.value })
              : choice.value}
          </option>
        ))}
      </select>
    </div>
  );
}
