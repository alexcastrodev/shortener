import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { generateAppointmentTimes } from './generate-appointment-times.service';
import type {
  GenerateAppointmentTimesParams,
  GenerateAppointmentTimesResponse,
} from './generate-appointment-times.types';

export function useGenerateAppointmentTimes(
  mutationProps?: UseMutationOptions<
    GenerateAppointmentTimesResponse,
    ResponseError,
    GenerateAppointmentTimesParams,
    unknown
  >
) {
  return useMutation({
    mutationFn: generateAppointmentTimes,
    ...mutationProps,
  });
}
