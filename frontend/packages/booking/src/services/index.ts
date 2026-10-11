import { z } from 'zod/v4';
import type { BookingMode } from '../mode.ts';
import { baseInput, baseValues } from '../shared/form.ts';
import { fromSchedule, toSchedule } from '../shared/schedule.ts';
import { blankService, serviceInput, serviceValues } from '../shared/service.ts';
import { requiredSchedule } from '../shared/validation.ts';
import { isGrouped } from './categories.ts';

export {
  MAX_CATEGORIES,
  isGrouped,
  newCategoryId,
  removeCategory,
  splitIntoCategories,
} from './categories.ts';

export const servicesMode: BookingMode = {
  name: 'services',

  validation: {
    fields: t => ({
      categories: z.array(
        z.object({
          name: z.string().trim().min(1, t('category_name_error')).max(60),
        })
      ),
    }),
    schedule: requiredSchedule,
    itemIssues: () => [],
  },

  initialValues: field => ({
    ...baseValues(field),
    mode: 'services',
    availability: toSchedule(undefined),
    categories: (field?.categories ?? []).map(item => ({
      id: item.id,
      name: item.name,
    })),
    services: (field?.services ?? []).map(service =>
      serviceValues(
        service,
        service.category_id ?? field?.categories?.[0]?.id ?? ''
      )
    ),
  }),

  newBooking: name => {
    const values = servicesMode.initialValues();
    values.services = [blankService(name)];
    return { services: servicesMode.toBookingInput(values, true).services };
  },

  blankItem: (values, name) =>
    blankService(name, values.categories[0]?.id ?? ''),

  toBookingInput: (values, creating) => {
    const grouped = isGrouped(values);
    return {
      ...baseInput(values, creating),
      categories: grouped
        ? values.categories.map(item => ({
            id: item.id,
            name: item.name.trim(),
          }))
        : [],
      services: values.services.map(service => ({
        ...serviceInput(service),
        ...(grouped ? { category_id: service.categoryId } : {}),
        ...fromSchedule(service),
      })),
    };
  },

  compile: field => field,

  scheduled: () => true,

  groupOf: (values, service) =>
    isGrouped(values)
      ? values.categories.find(item => item.id === service.categoryId)?.name
      : undefined,
};
