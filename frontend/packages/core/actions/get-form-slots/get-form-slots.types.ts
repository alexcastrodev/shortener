export interface FormSlot {
  starts_at: string;
  date: string;
  time: string;
  remaining: number;
}

export interface GetFormSlotsResponse {
  time_zone: string;
  slots: FormSlot[];
}
