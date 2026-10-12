import type { FormField } from '@internal/core/types/Form';

export type Refusal = { service?: string; date?: string; time?: string };

export type TakenWords = {
  plain: string;
  service: (service: string) => string;
  serviceAt: (service: string, date: string, time: string) => string;
};

export function takenMessage(
  words: TakenWords,
  field: Pick<FormField, 'services'> | undefined,
  refusal: Refusal | undefined
) {
  const service = field?.services?.find(item => item.id === refusal?.service)?.name;
  if (!service) return words.plain;
  if (refusal?.date && refusal.time)
    return words.serviceAt(service, refusal.date, refusal.time);
  return words.service(service);
}
