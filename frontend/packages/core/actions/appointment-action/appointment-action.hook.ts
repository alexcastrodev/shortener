import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { appointmentAction } from './appointment-action.service';
import type { AppointmentActionParams } from './appointment-action.types';

export function useAppointmentAction(
  mutationProps?: UseMutationOptions<
    void,
    ResponseError,
    AppointmentActionParams,
    unknown
  >
) {
  return useMutation({ mutationFn: appointmentAction, ...mutationProps });
}
