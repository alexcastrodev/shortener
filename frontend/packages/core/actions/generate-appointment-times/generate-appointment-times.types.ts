export interface TimeRange {
  from: string;
  to: string;
}

export interface GenerateAppointmentTimesParams {
  from: string;
  to: string;
  step: number;
  duration: number;
  lunch?: TimeRange;
  blocks?: TimeRange[];
}

export type GenerateTimesError =
  | 'invalid_time'
  | 'invalid_step'
  | 'invalid_duration'
  | 'invalid_range'
  | 'no_times';

export interface GenerateAppointmentTimesResponse {
  times: string[];
  warnings: string[];
  errors: GenerateTimesError[];
}
