import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { LoadedSlots } from '@internal/core/actions/get-form-slots/get-form-slots.types';

export type Cache = { key: string; months: Record<string, LoadedSlots> };

export type PickerMemory = {
  month: string;
  setMonth: (month: string) => void;
  cache: Cache;
  setCache: Dispatch<SetStateAction<Cache>>;
  seeking: { current: boolean };
};

export function usePickerMemory(
  initialMonth: string,
  seeking: boolean
): PickerMemory {
  const [month, setMonth] = useState(initialMonth);
  const [cache, setCache] = useState<Cache>({ key: '', months: {} });
  const seek = useRef(seeking);
  return { month, setMonth, cache, setCache, seeking: seek };
}
