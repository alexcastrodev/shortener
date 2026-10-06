export interface FormSlot {
  starts_at: string;
  date: string;
  time: string;
  remaining: number;
}

export interface FullSlot {
  starts_at: string;
  date: string;
  time: string;
}

export interface GetFormSlotsResponse {
  time_zone: string;
  slots: FormSlot[];
  full?: FullSlot[];
}

export interface LoadedSlots {
  slots: FormSlot[];
  full: FullSlot[];
}
